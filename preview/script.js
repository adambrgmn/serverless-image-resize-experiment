import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';

const urls = {
  cdn: 'https://api.fransvilhelm.com/cat',
  apig:
    'https://e4i1fvixd2.execute-api.eu-north-1.amazonaws.com/development/cat',
};

function App() {
  const [url, setUrl] = useState(urls.cdn);
  const [ignoreWebp, setIgnoreWebp] = useState(true);

  const handleUrlChange = useCallback(event => setUrl(event.target.value));
  const handleWebpChange = useCallback(() => setIgnoreWebp(!ignoreWebp));
  const finalUrl = useMemo(() => `${url}${ignoreWebp ? '?webp=0' : ''}`, [
    url,
    ignoreWebp,
  ]);

  return (
    <div>
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

        <label htmlFor="use-webp">
          <input
            type="checkbox"
            id="use-webp"
            checked={ignoreWebp}
            onChange={handleWebpChange}
          />
          Ignore WebP support
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
