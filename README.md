# Lambda Image Resizer with CloudFront

This is an experiment to get a Lambda function – that resizes images – to work
together with CloudFront (and CloudFlare(!)). And gluing it all together with
[Serverless](https://serverless.com).

I got stuck at a few places, but I learned a lot in the way. Hopefully it will
be useful for you.

# Background

The back story to all this is that I would like to implement something similar
to [humanmade/tachyon](https://github.com/humanmade/tachyon) for a client site.
But automating the deployment of tachyon isn't straightforward for me – I'm not
familiar with writing CloufFormation templates from the ground and all that.

But I do have some experience of the Serverless framework and I decided to give
it a shot.

# Disclaimer

While trying all this out I've not focused on building a functioning resize
handler. Instead I've focused on setting up Serverless and get all dependecies
working. Therefore, if you want to learn how to code the handler you have to
search elsewhere. The problems and solutions here are focused on setting up the
infrastructure around the handler.

# The problems (and the solutions)

## Using Sharp

The only problem I encountered while developing this very basic static resizer
found in this repo was using [sharp](https://github.com/lovell/sharp). sharp
uses libvips under the hood and it's installed together with the module. But
it's a binary and since I'm on a Mac it automatically bundles libvps compiled
for a Mac and Lambdas run on Linux instances. This becomes a problem since
Serverless packages everything on the machine running `serverless deploy` and
there are no install steps inside the lambda container.

At first I tried the first solution from [sharp's documentation](https://sharp.pixelplumbing.com/en/stable/install/#aws-lambda).
But it proved to not work as I had expected. Instead I went with a solution
inspired by the second tip from the sharp docs – a Docker-based
install-build-deploy workflow.

First the `Dockerfile`:

```dockerfile
# The base image resembles the Lambda runtime as closely as possible
FROM lambci/lambda:build-nodejs8.10
RUN npm install -g yarn

# The STAGE environment variable can be overridden by defining it before deploy
# Example: `STAGE=production yarn run deploy`
ENV STAGE development

# We copy package.json and yarn.lock before any other files in order to leverage
# Dockers caching before running `yarn install`
COPY package.json yarn.lock ./
RUN yarn install --force

# All files are blindly copied over (except those defined inside .dockerignore)
COPY . .

# Lastly we build out the dist files
RUN yarn run build
```

Then we will use that Dockerfile to run the deploy commands.

```sh
STAGE=production
docker build -t lambda-deploy .
docker run --env-file .env --env STAGE=${STAGE} lambda-deploy yarn serverless deploy --stage=${STAGE}
```

This `Dockerfile` will take the command given at the end (after `lambda-deploy`,
the name of the image) and run that script in the images environment, which in
this case closely resembles the AWS Lambda runtime.

This means that the correct native modules will be installed and packaged
correctly.

## Returning binaries

API Gateway does not simply return whatever you want it to return. There is
always some catch – and of course that's the case when trying to return an image
from a Lambda.

#### The handler

**Note that I'm using the default
[`lambda-proxy` integration](https://serverless.com/framework/docs/providers/aws/events/apigateway#lambda-proxy-integration)
here and I've no experience using anything else**

The first thing to do in order to return binary data (e.g. an image) from a
Lambda function is to return a base64 encoded buffer as body and specify
`isBase64Encoded: true`. You also need to specify the correct MIME-type in the
`Content-Type` header.

```js
export const handler = async (event, context) => {
  // Tip: use util.promisify(fs.readFile) to use promises with fs
  const buffer = await readFile(path.join(__dirname, '../static/cat.jpg'));

  return {
    statusCode: 200, // I think 200 is implied if not present, but I include it for brevity
    headers: {
      'Content-Type': 'image/jpeg', // Correct MIME-type for a .jpg-image (.png=image/png, .webp=image/webp)
      'Cache-Control': 'max-age=31536000', // Cache this for 1 year (in seconds), will be important later
    },
    body: buffer.toString('base64'), // Take the buffer and convert it to a base64 encoded string
    isBase64Encoded: true, // Tell API Gateway that this body is encoded
  };
};
```

This solves the handler part of the puzzle. But we still have to tell API
Gateway that we migth like to return a binary response at some point.

#### serverless.yml

By default there is no way to tell API Gateway to return a binary with
Serverless framework. But fortunately for us there are plugins – which
[this article](https://medium.com/nextfaze/binary-responses-with-serverless-framework-and-api-gateway-5fde91376b76)
taught me.

First we need to install `serverless-apigw-binary`:

```sh
yarn add --dev serverless-apigw-binary
```

And then add the plugin config to `serverless.yml`:

```yml
plugins:
  - serverless-apigw-binary

custom:
  apigwBinary:
    types:
      - 'image/*'
```

This will tell API Gateway that if we return anything with the `Content-Type`
equal to `image/jpeg` – or `image/png` and so on – together with a base64
encoded body and `isBase64Encoded` set to `true` API Gateway can treat it as
binary.

But it's also important to note here that API Gateway will ignore treating it as
binary if the `Accept` header is not present on the request, or if the `Accept`
header doesn't the types specified. But this will be the case if a request comes
from a browser with the html `<img src="https://api.hi.com/cat.jpg">`.

If you're trying this with something like `curl` then remeber to also send the
`Accept` header.

```sh
curl '<api_url>' -H 'Accept: image/webp,image/apng,image/*,*/*;q=0.8' > cat.jpg
```

([Read a bit more about when API Gateway will, and wont, return a binary response on this link](https://forums.aws.amazon.com/thread.jspa?messageID=753476&#758387))

But this is not all. For some reason we also need `serverless-apigwy-binary`
(note the extra "y"). Install and add the necessery config:

```sh
yarn add --dev serverless-apigwy-binary
```

```yml
plugins:
  - serverless-apigw-binary
  - serverless-apigwy-binary #!

# ...

functions:
  cat:
    handler: dist/handler.cat
    events:
      - http:
          path: cat
          method: get
          contentHandling: CONVERT_TO_BINARY # This is the important line
```

This setup will give us a fully working Lambda function that will return a
binary image – try it by running `serverless deploy` and visit the url provided
to you.

But this setup has one major flaw, and one not so major flaw:

1. This lambda function will be invoked every time someone makes a request to
   the url. This is a **major** flaw. Since my goal is to process images the
   response times might get crazy and the bill from Amazon will be even crazier.
2. The url provided from API Gateway does not look very nice – and it will be
   hard to remember. This is not a major flaw, but it is inconvinient.

## Setting up CloudFront

In order to reduce the calls to our Lambda image resizer I would like to put AWS
CloudFront in front of it and return cached responses when possible. But once
again this is not baked into the Serverless framework – enter another plugin
`serverless-api-cloudfront`.

It is pretty straight forward. Install the plugin:

```sh
yarn add --dev serverless-api-cloudfront
```

And add the configuration:

```yml
plugins:
  - serverless-apigw-binary
  - serverless-apigwy-binary
  - serverless-api-cloudfront #!

custom:
  # ...
  apiCloudFront:
    compress: true
    cookies: none

    # Do not miss the headers – this caused me a lot of pain. If it's not
    # defined here CloudFront will not even pass it on to API Gateway and the
    # Lambda function
    headers:
      - Accept

    # Since my resize implementation relies on query strings this is needed in
    # order to preperly cache the response otherwise
    # "https://api.hi.co/cat?w=100" will be equal to
    # "https://api.hi.co/cat?w=999" and someone will get the wrong image
    querystring: all
```

The last thing we have to do before this can be deployed is to make sure that
the user who will deploy this have the correct permissions. In order to do that
you need to go to AWS IAM and attach five additional policys to the policy
statement:

- `cloudfront:CreateDistribution`
- `cloudfront:GetDistribution`
- `cloudfront:UpdateDistribution`
- `cloudfront:DeleteDistribution`
- `cloudfront:TagResource`

Now when you run `serverless deploy` you will have to wait some time –
CloudFront is extremly slow (I've waited atleast 30 minutes sometimes). When
it's done you will have CloudFront in front of your Lambda and the url is a
little bit better – something like `https://<id>.cloudfront.net` instead of that
awful API Gateway url.

But it's not perfect – I want to use my own custom domain!

## CloudFront with custom domain (AND CloudFlare)

I've developed a habit where I manage all my own and some clients domains on
CloudFlare. Their DNS management is better than anything I've ever tested and
it's super fast. So during my experiments I decided I wanted to keep managing my
domains using CloudFlare and this proved to be easier than I thaught.

In my case I wanted to use CloudFront with `api.fransvilhelm.com`. But to use a
custom domain with CloudFront you have to go thru AWS Route 53. Here's what I
did:

1. Create a new hosted zone in Route 53 for `fransvilhelm.com`
2. Take the nameservers provided back to CloudFlare and create new NS-records
   for `api.fransvilhelm.com` pointing to those Amazon-nameservers
3. Back in Route 53 I create two records with equal settings – one with type A
   and one type AAAA
   1. Name: `api`
   2. Type: `A` or `AAAA`
   3. Alias: `yes`
   4. Alias target: choose your CloudFront distribution from the dropdown
   5. Routing policy: `Simple`
   6. Evaluate Target Health: `no`

And then we're done with Route 53. And in order to finalize this we must add
some extra configurations to `serverless.yml`:

```yml
custom:
  # ...
  apiCloudFront:
    # The domain you would like to use. Might also be a list of domains
    domain: api.fransvilhelm.com
    # A AWS Certificate Manager issued SSL certificate, preferably issued for
    # api.fransvilhelm.com or *.fransvilhelm.com – must be in us-east-1 region
    certificate: <arn>
    compress: true
    cookies: none
    headers:
      - Accept
    querystring: all
```

And with one last `serverless deploy` we should be done! Phew!

---

It might seem like a lot of information, but note that I've been very thourogh
in my explanations here. And at hindsight it wasn't that hard. At the end the
only "manual" step was setting up Route 53 (and CloudFlare) to point to my
CloudFront distribution.

But after that everything will be easily configured through the settings in
`serverless.yml` and everything will be updated when running
`serverless deploy`.

Hope you enjoyed!
