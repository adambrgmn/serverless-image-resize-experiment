const urls = {
  cdn: '<cdn_url>',
  apig: '<apig_url>',
};

const rootEl = document.getElementById('root');
const radioUseCdn = document.getElementById('use-cdn');
const radioUseApig = document.getElementById('use-apig');
const checkboxUseWebp = document.getElementById('use-webp');

let use = 'apig';
let webp = false;

function render() {
  const imgUrl = `${urls[use]}/cat${webp ? '?webp=1' : ''}`;

  const prevImg = rootEl.querySelector('#image');
  if (prevImg) rootEl.removeChild(prevImg);

  const newImg = document.createElement('img');
  newImg.setAttribute('id', 'image');
  newImg.setAttribute('src', imgUrl);

  rootEl.appendChild(newImg);
}

checkboxUseWebp.addEventListener('change', event => {
  webp = event.target.checked;
  render();
});

const handler = event => {
  use = event.target.value;
  render();
};

radioUseCdn.addEventListener('change', handler);
radioUseApig.addEventListener('change', handler);

render();
