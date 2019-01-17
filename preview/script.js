import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';

const urls = {
  cdn: 'https://api.fransvilhelm.com/',
  apig: 'https://e4i1fvixd2.execute-api.eu-north-1.amazonaws.com/development/',
};

const imgs = {
  cat: 'cat.jpg',
  dog: 'dog.jpg',
};

function App() {
  const [url, setUrl] = useState(urls.cdn);
  const [img, setImg] = useState(imgs.cat);
  const [query, setQuery] = useState({ w: 400, h: 0, ignore_webp: false });

  const handleUrlChange = useCallback(e => setUrl(e.target.value));
  const handleImgChange = useCallback(e => setImg(e.target.value));

  const handleWebpChange = useCallback(() =>
    setQuery({ ...query, ignore_webp: !query.ignore_webp }),
  );
  const handleWidthChange = useCallback(e =>
    setQuery({ ...query, w: Number.parseInt(e.target.value) }),
  );
  const handleHeightChange = useCallback(e =>
    setQuery({ ...query, h: Number.parseInt(e.target.value) }),
  );

  const finalUrl = useMemo(
    () =>
      `${url}${img}?${Object.entries(query)
        .reduce((q, [key, val]) => {
          if (!val) return q;
          return [...q, `${key}=${val}`];
        }, [])
        .join('&')}`,
    [url, img, query],
  );

  return (
    <div>
      <div>
        <label htmlFor="use-cat">
          <input
            type="radio"
            name="img"
            id="use-cat"
            value={imgs.cat}
            checked={img === imgs.cat}
            onChange={handleImgChange}
          />{' '}
          /cat.jpg
        </label>
        <label htmlFor="use-dog">
          <input
            type="radio"
            name="img"
            id="use-dog"
            value={imgs.dog}
            checked={img === imgs.dog}
            onChange={handleImgChange}
          />{' '}
          /dog.jpg
        </label>
      </div>

      <div>
        <label htmlFor="use-cdn">
          <input
            type="radio"
            name="url"
            id="use-cdn"
            value={urls.cdn}
            checked={url === urls.cdn}
            onChange={handleUrlChange}
          />
          Use CDN
        </label>
        <label htmlFor="use-apig">
          <input
            type="radio"
            name="url"
            id="use-apig"
            value={urls.apig}
            checked={url === urls.apig}
            onChange={handleUrlChange}
          />
          Use API Gateway
        </label>
        <label htmlFor="ignore-webp">
          <input
            type="checkbox"
            name="ignore-webp"
            id="ignore-webp"
            checked={query.ignore_webp}
            onChange={handleWebpChange}
          />
          Ignore WebP support
        </label>
      </div>

      <div>
        <label htmlFor="width">
          Width:{' '}
          <input
            type="number"
            id="width"
            value={query.w}
            onChange={handleWidthChange}
            step="100"
          />
        </label>
        <label htmlFor="height">
          Height:{' '}
          <input
            type="number"
            id="height"
            value={query.h}
            onChange={handleHeightChange}
            step="100"
          />
        </label>
      </div>

      <div>
        <img src={finalUrl} alt="A small cute kitten" />
      </div>
    </div>
  );
}

const rootEl = document.getElementById('root');
ReactDOM.render(<App />, rootEl);
