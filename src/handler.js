import AWS from 'aws-sdk';
import sharp from 'sharp';

const log = entry => console.log(JSON.stringify(entry));

const bucket = process.env.S3_BUCKET;
const region = process.env.S3_REGION;
const S3 = new AWS.S3({ region });

const makeUnauthenticatedRequest = (...args) =>
  new Promise((resolve, reject) => {
    S3.makeUnauthenticatedRequest(...args, (err, res) => {
      if (err) return reject(err);
      return resolve(res);
    });
  });

const resizeBuffer = async (buffer, { width, height, quality, forceWebp }) => {
  const image = sharp(buffer).withMetadata();
  image.resize({ width, height });

  if (forceWebp) {
    image.webp({ quality });
  } else {
    const { format } = await image.metadata();
    switch (format) {
      case 'png':
        image.png({ quality });
        break;

      case 'webp':
        image.webp({ quality });
        break;

      case 'jpeg':
      default:
        image.jpeg({ quality });
    }
  }

  const res = await image.toBuffer({ resolveWithObject: true });
  return res;
};

const shouldIgnoreWebp = query =>
  query.ignore_webp != null &&
  query.ignore_webp !== 'false' &&
  query.ignore_webp !== '0';
const supportsWebp = headers =>
  headers.Accept && headers.Accept.includes('image/webp');

export async function resize(event, context) {
  try {
    log(event);

    const key = decodeURI(event.path.substring(1));
    const query = event.queryStringParameters || {};

    const resizeArgs = {
      ...(query.w ? { width: Number.parseInt(query.w) } : null),
      ...(query.h ? { height: Number.parseInt(query.h) } : null),
      ...(query.quality ? { quality: Number.parseInt(query.quality) } : null),
      forceWebp: !shouldIgnoreWebp(query) && supportsWebp(event.headers),
    };

    log({ bucket, region, key, query, resizeArgs });

    const { Body } = await makeUnauthenticatedRequest('getObject', {
      Bucket: bucket,
      Key: key,
    });

    const { data, info } = await resizeBuffer(Body, resizeArgs);

    const maxAge =
      process.env.NODE_ENV === 'production'
        ? 365 * 24 * 60 * 60 // One year if in production
        : 60; // One minute if in development mode

    const response = {
      statusCode: 200,
      headers: {
        'Content-Type': `image/${info.format}`,
        'Cache-Control': `max-age=${maxAge}`,
        'Last-Modified': new Date().toUTCString(),
      },
      body: data.toString('base64'),
      isBase64Encoded: true,
    };

    log({ ...response, body: '<raw_base64_encoded_image_data>' });
    return response;
  } catch (error) {
    log({ error: true, message: error.message });
    throw error;
  }
}
