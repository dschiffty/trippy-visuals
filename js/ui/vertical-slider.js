/* ============================================
   Reusable vertical slider component.
   Same visual style as Camera mode's blend
   strength slider — dark semi-transparent pill
   with a rotated horizontal range input.
   ============================================ */

/**
 * Create a vertical slider wrapped in a dark pill container.
 * @param {object} opts
 * @param {string} opts.icon       - Emoji or text label shown below the slider
 * @param {number} opts.min        - Minimum value (default 0)
 * @param {number} opts.max        - Maximum value (default 1)
 * @param {number} opts.step       - Step increment (default 0.05)
 * @param {number} opts.value      - Initial value
 * @param {string} [opts.className] - Extra class for the wrapper
 * @param {function} opts.onChange  - Callback(value: number)
 * @returns {{ wrap: HTMLElement, slider: HTMLInputElement, setVisible: (v: boolean) => void }}
 */
export function createVerticalSlider(opts) {
  const {
    icon = '',
    min = 0,
    max = 1,
    step = 0.05,
    value = 0.5,
    className = '',
    onChange = () => {},
  } = opts;

  const wrap = document.createElement('div');
  wrap.className = `cam-blend-wrap${className ? ' ' + className : ''}`;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'cam-blend-slider';
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(value);
  slider.orient = 'vertical';
  slider.addEventListener('input', () => {
    onChange(parseFloat(slider.value));
  });

  wrap.appendChild(slider);

  if (icon) {
    const iconEl = document.createElement('span');
    iconEl.className = 'cam-blend-icon';
    iconEl.textContent = icon;
    wrap.appendChild(iconEl);
  }

  const setVisible = (visible) => {
    wrap.style.display = visible ? '' : 'none';
  };

  return { wrap, slider, setVisible };
}
