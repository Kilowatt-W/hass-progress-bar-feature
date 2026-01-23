import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.0.1/lit-element.js?module";

class ProgressBarFeature extends LitElement {
  static get properties() {
    return {
      hass: undefined,
      config: undefined,
      stateObj: undefined,
    };
  }

  static getStubConfig() {
    return {
      type: "custom:progress-bar-feature",
      // show_value: true,
      // show_name: true,
      // name: "Fortschritt",
      // value: { entity: "sensor.xyz" }, // optional override
      // text_position: "center", // "left" | "center" | "right"
      // text_color: "--text-primary-color",
      // text_shadow: "0 1px 2px rgba(0,0,0,.35)",
      // text_size: "12px",
      // format: { suffix: "%", decimals: 0 },
    };
  }

  static log = (...msg) => console.log('ProgressBarFeature:', ...msg);
  static warn = (...msg) => console.warn('ProgressBarFeature:', ...msg);
  static error = (msg, options) => { throw new Error(`ProgressBarFeature: ${msg}`, options); }

  setConfig(config) {
    if (!config) {
      ProgressBarFeature.error('Invalid configuration');
    }

    this.config = config;
  }

  static readEntityOrAttribute(id, states, stateObj) {
    return id.includes('.')
      ? states?.[id]?.state
      : stateObj?.attributes[id];
  }

  static parseTimeString(time) {
    if (!time) {
      return 0;
    }
    const [ hours, minutes, seconds ] = time.split(':').map(Number);
    return (hours * 60 * 60) + (minutes * 60) + seconds;
  }

  static resolveCssVars(value) {
    return value?.startsWith?.('--') ? `var(${value})` : value;
  }
  
  static resolveColor(color, progress) {
    if (color === 'meter') {
      // We multiply by 1.2 to make the green a little more vibrant at 100%
      color = `hsl(calc(${progress} * 1.2), 100%, 40%)`;
    }

    return ProgressBarFeature.resolveCssVars(color || '--primary-color');
  }

  static resolveColorBg(background) {
    return background
      ? ProgressBarFeature.resolveCssVars(background)
      : 'hsla(from var(--progress-bar-color) h s l / .2)';
  }

  static resolveSize(config) {
    const { size, position } = config;

    return ProgressBarFeature.resolveCssVars(
      size || position && '3px' || '--feature-height'
    );
  }

  static resolveTemplate(template) {
    return template;
  }

  static resolveTimeProgress(time, states, stateObj) {
    if (time.initial || time.remaining) {
      if (!time.initial || !time.remaining) {
        ProgressBarFeature.warn('time.initial & time.remaining are co-dependent');
        return;
      }
      const initial_value = ProgressBarFeature.readEntityOrAttribute(time.initial, states, stateObj);
      const remaining_value = ProgressBarFeature.readEntityOrAttribute(time.remaining, states, stateObj);
      if (!initial_value || !remaining_value) {
        ProgressBarFeature.warn(
          'Invalid values for time.initial and/or time.remaining, must be HH:MM:SS',
          { initial_value, remaining_value }
        );
        return;
      }
      
      const initial = ProgressBarFeature.parseTimeString(initial_value);
      const remaining = ProgressBarFeature.parseTimeString(remaining_value);
      const elapsed = initial - remaining;
      return Math.round((elapsed / initial) * 100);
    }

    if (time.start || time.end) {
      if (!time.start || !time.end) {
        ProgressBarFeature.warn('time.start & time.end are co-dependent');
        return;
      }
      const start_value = ProgressBarFeature.readEntityOrAttribute(time.start, states, stateObj);
      const end_value = ProgressBarFeature.readEntityOrAttribute(time.end, states, stateObj);
      if (!start_value || !end_value) {
        ProgressBarFeature.warn(
          'Invalid values for time.start and/or time.end, must be Date strings',
          { start_value, end_value }
        );
        return;
      }

      const start = new Date(start_value);
      const end = new Date(end_value);
      const total = end - start;
      const elapsed = new Date() - start;
      return Math.round((elapsed / total) * 100);
    }
  }

  static resolveProgress(config, stateObj, states) {
    const {
      entity,
      attribute,
      template,
      inverse,
      time,
    } = config;

    let progress = 0;

    if (attribute || entity) {
      progress = ProgressBarFeature.readEntityOrAttribute(attribute || entity, states, stateObj);
    
    } else if (template) {
      progress = ProgressBarFeature.resolveTemplate(template);

    } else if (time) {
      progress = ProgressBarFeature.resolveTimeProgress(time, states, stateObj);
    
    } else {
      ProgressBarFeature.error('Must pass entity or attribute');
    }

    if (isNaN(progress)) {
      ProgressBarFeature.warn('Progress value must be a number, currently:', progress);
      return 0;
    }

    if (progress < 0 || progress > 100) {
      ProgressBarFeature.warn('Progress value must be a number between 0 - 100, currently:', progress);
      progress = Math.min(Math.max(progress, 0), 100);
    }

    return Math.round(inverse ? 100 - progress : progress);
  }

  // NEW: format the displayed value
  static formatValue(raw, config) {
    const fmt = config?.format || {};
    const decimals = Number.isFinite(fmt.decimals) ? fmt.decimals : undefined;
    const prefix = fmt.prefix ?? '';
    const suffix = fmt.suffix ?? '%';

    // If raw is numeric, format it; else return as-is
    const num = Number(raw);
    const val = Number.isFinite(num)
      ? (decimals === undefined ? `${num}` : num.toFixed(decimals))
      : `${raw ?? ''}`;

    return `${prefix}${val}${suffix}`;
  }

  // NEW: resolve what text to show (name + value)
  static resolveDisplayText(config, stateObj, states, progress) {
    const showName = config.show_name ?? false;
    const showValue = config.show_value ?? false;

    if (!showName && !showValue) return '';

    // label
    const name = config.name ?? stateObj?.attributes?.friendly_name ?? '';

    // value source:
    // - if config.value is provided, use that (entity/attribute/template)
    // - otherwise show the same progress value
    let rawValue = progress;

    if (config.value) {
      const v = config.value;
      if (v.attribute || v.entity) {
        rawValue = ProgressBarFeature.readEntityOrAttribute(v.attribute || v.entity, states, stateObj);
      } else if (v.template !== undefined) {
        rawValue = ProgressBarFeature.resolveTemplate(v.template);
      } else {
        ProgressBarFeature.warn('config.value must define entity/attribute or template');
      }
    }

    const valueStr = ProgressBarFeature.formatValue(rawValue, config);

    if (showName && showValue) return `${name}: ${valueStr}`;
    if (showName) return `${name}`;
    return `${valueStr}`;
  }

  static getPosition(position, size) {
    switch (position) {
      case 'top':
        return 'top: 0';
      case 'bottom':
        return 'bottom: 0';
      default:
        return '';
    }
  }

  static closestPierceShadow(node, selector) {
    if (!node) {
      return null;
    }

    if (node instanceof ShadowRoot) {
      return ProgressBarFeature.closestPierceShadow(node.host, selector);
    }

    if (node instanceof HTMLElement && node.matches(selector)) {
      return node;
    }

    return ProgressBarFeature.closestPierceShadow(node.parentNode, selector);
  }

  static fixCardStyles(node) {
    // We need to turn off the relative positioning on some parents to pull the progress bar to the edge
    const container = ProgressBarFeature.closestPierceShadow(node, '.container');
    container?.style.setProperty('position', 'static');
    const cardFeatures = ProgressBarFeature.closestPierceShadow(node, 'hui-card-features');
    cardFeatures?.style.setProperty('position', 'static');

    // And cut off the edges of the bar to match the border radius
    const card = ProgressBarFeature.closestPierceShadow(node, 'ha-card');
    card?.style.setProperty('overflow', 'hidden');

    // The default behavior is to increase the row size of the card for each feature
    // But if we're attaching the progress to the card edge, we don't want that
    // So we have to pierce through multiple layers of shadow dom to override the row size
    const cardContainer = ProgressBarFeature.closestPierceShadow(node, '.card');
    const cardContainerRowSize = getComputedStyle(cardContainer)?.getPropertyValue('--row-size');
    if (cardContainerRowSize) {
      const newRowSize = parseInt(cardContainerRowSize) - 1;
      cardContainer?.style.setProperty('--row-size', newRowSize);
    }
  }

  render() {
    if (
      !this.config ||
      !this.hass ||
      !this.stateObj
    ) {
      return null;
    }

    const progress = ProgressBarFeature.resolveProgress(this.config, this.stateObj, this.hass?.states);
    const color = ProgressBarFeature.resolveColor(this.config.color, progress);
    const colorBg = ProgressBarFeature.resolveColorBg(this.config.background);
    const size = ProgressBarFeature.resolveSize(this.config);
    const position = ProgressBarFeature.getPosition(this.config.position, size);

    // NEW: text
    const text = ProgressBarFeature.resolveDisplayText(this.config, this.stateObj, this.hass?.states, progress);
    const textPosition = (this.config.text_position || 'center').toLowerCase();
    const textColor = ProgressBarFeature.resolveCssVars(this.config.text_color || '--text-primary-color');
    const textShadow = this.config.text_shadow ?? '0 1px 2px rgba(0,0,0,.35)';
    const textSize = ProgressBarFeature.resolveCssVars(this.config.text_size || '12px');

    if(this.config.position) {
      ProgressBarFeature.fixCardStyles(this);
    }

    return html`
      <div 
        class="
          progress-bar
          ${this.config.position ? `progress-bar-anchored` : ''}
        " 
        style="
          --progress-bar-color: ${color};
          --progress-bar-color-bg: ${colorBg};
          --progress-bar-width: ${progress}%;
          --progress-bar-size: ${size};
          --progress-bar-text-color: ${textColor};
          --progress-bar-text-shadow: ${textShadow};
          --progress-bar-text-size: ${textSize};
          ${position}
        "
      >
        ${text ? html`
          <div class="progress-text progress-text-${textPosition}">
            ${text}
          </div>
        ` : ''}
      </div>
    `;
  }

static get styles() {
  return css`
    .progress-bar {
      position: relative;
      height: var(--progress-bar-size);
      /* wichtig: eigener Stacking-Context */
      z-index: 0;
    }

    .progress-bar-anchored {
      position: absolute;
      left: 0;
      width: 100%;
    }

    .progress-bar::before,
    .progress-bar::after {
      content: '';
      position: absolute;
      inset: 0; /* statt width/height einzeln */
      height: var(--progress-bar-size);
      border-radius: var(--feature-border-radius, 12px);
    }

    /* Background */
    .progress-bar::before {
      background-color: var(--progress-bar-color-bg);
      z-index: 0;
    }

    /* Bar */
    .progress-bar::after {
      background-color: var(--progress-bar-color);
      width: var(--progress-bar-width);
      z-index: 1;
    }

    /* text and value always in front */
    .progress-text {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      padding: 0 8px;
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--progress-bar-text-color);
      text-shadow: var(--progress-bar-text-shadow);
      font-size: var(--progress-bar-text-size);
      line-height: 1;
      z-index: 2;
    }

    .progress-text-left { justify-content: flex-start; }
    .progress-text-center { justify-content: center; }
    .progress-text-right { justify-content: flex-end; }
  `;
}

}

customElements.define("progress-bar-feature", ProgressBarFeature);

window.customCardFeatures = window.customCardFeatures || [];
window.customCardFeatures.push({
  type: "progress-bar-feature",
  name: "Progress bar",
  configurable: true,
});
