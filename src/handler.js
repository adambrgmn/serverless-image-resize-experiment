import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import sharp from 'sharp';

const readFile = promisify(fs.readFile);

export const cat = async (event, context) => {
  console.log(JSON.stringify(event));

  const imgBuffer = await readFile(path.join(__dirname, '../static/cat.jpg'));

  let image = sharp(imgBuffer).resize({
    width: 200,
    height: 200,
    fit: sharp.fit.cover,
    position: sharp.strategy.entropy,
  });

  if (event.queryStringParameters && event.queryStringParameters.webp === '1') {
    image = image.webp();
  }

  const { info, data } = await image.toBuffer({ resolveWithObject: true });

  console.log(JSON.stringify(info));

  const maxAge =
    process.env.NODE_ENV === 'production'
      ? 365 * 24 * 60 * 60 // One year if in production
      : 60; // One minute if in development mode

  return {
    statusCode: 200,
    headers: {
      'Content-Type': `image/${info.format}`,
      'Cache-Control': `max-age=${maxAge}`,
      'Last-Modified': new Date().toUTCString(),
    },
    body: data.toString('base64'),
    isBase64Encoded: true,
  };
};
