const axios = require('axios');

const getImg = accept =>
  axios({
    url: 'https://api.fransvilhelm.com/cat',
    method: 'get',
    headers: { Accept: accept },
  });

const logResponse = ({ headers }) =>
  console.log({
    'content-type': headers['content-type'],
    'x-cache': headers['x-cache'],
  });

async function main() {
  try {
    logResponse(await getImg('image/webp'));
    logResponse(await getImg('image/*'));
  } catch (error) {
    console.error(error);
  }
}

main();
