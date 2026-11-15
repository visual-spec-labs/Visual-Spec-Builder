import backgroundUrl from "../assets/hash-1.svg";
import imageUrl from "../assets/한글-사진 (1)+100-.svg";

const image = document.createElement("img");
image.id = "node-image";
image.src = imageUrl;
image.alt = "";
image.addEventListener("load", () => {
  document.body.dataset.imageWidth = String(image.naturalWidth);
  document.body.dataset.imageUrl = image.currentSrc;
});

const background = document.createElement("div");
background.id = "background-image";
background.style.width = "64px";
background.style.height = "64px";
background.style.backgroundImage = `url(${JSON.stringify(backgroundUrl)})`;
document.querySelector("#root").append(image, background);

const backgroundImage = new Image();
backgroundImage.addEventListener("load", () => {
  document.body.dataset.backgroundWidth = String(backgroundImage.naturalWidth);
  document.body.dataset.backgroundUrl = backgroundImage.src;
});
backgroundImage.src = backgroundUrl;
