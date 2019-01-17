import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import sharp from 'sharp';

const readFile = promisify(fs.readFile);

const log = entry => console.log(JSON.stringify(entry));

export const cat = async (event, context) => {
  log(JSON.stringify(event));

  const imgBuffer = await readFile(path.join(__dirname, '../static/cat.jpg'));
  const image = sharp(imgBuffer).withMetadata();

  image.resize({
    width: 200,
    height: 200,
    fit: sharp.fit.cover,
    position: sharp.strategy.entropy,
  });

  const ignoreWebp =
    event.queryStringParameters && event.queryStringParameters.webp === '0';
  const supportsWebp =
    event.headers.Accept && event.headers.Accept.includes('image/webp');

  if (!ignoreWebp && supportsWebp) image.webp();

  const { info, data } = await image.toBuffer({ resolveWithObject: true });

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

  log(JSON.stringify({ ...response, body: '<raw_base64_encoded_image_data>' }));
  return response;
};
