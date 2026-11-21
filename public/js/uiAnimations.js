export function animateFadeIn(element, duration) {
  element.style.animation = "fadeIn " + duration;
  element.style.visibility = "visible";
}

export function triggerElementAnimation(element, animationClass) {
  while (element.classList.length > 0)
    element.classList.remove(element.classList.item(0));
  void element.offsetWidth;
  element.classList.add(animationClass);
}
