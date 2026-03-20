document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const tabs = document.querySelectorAll('.type-btn');
  const lengthSlider = document.getElementById('length-slider');
  const lengthInput = document.getElementById('length-input');
  const passwordOutput = document.getElementById('password-output');
  const btnCopy = document.getElementById('btn-copy');
  const btnRefresh = document.getElementById('btn-refresh');

  const optionsRandom = document.getElementById('options-random');
  const optionsMemorable = document.getElementById('options-memorable');
  const optionsPin = document.getElementById('options-pin');

  // Options inputs
  const optNumbers = document.getElementById('opt-numbers');
  const optSymbols = document.getElementById('opt-symbols');
  const optCapitalize = document.getElementById('opt-capitalize');
  const optFullwords = document.getElementById('opt-fullwords');

  // State
  let currentMode = 'random'; // random, memorable, pin

  // Config per mode
  const modeConfig = {
    random: { min: 8, max: 100, default: 20 },
    memorable: { min: 3, max: 15, default: 4 },
    pin: { min: 3, max: 12, default: 6 }
  };

  // --- Utility Functions ---

  const getRandomInt = (max) => Math.floor(Math.random() * max);

  const updateSliderBackground = () => {
    const val = lengthSlider.value;
    const min = lengthSlider.min;
    const max = lengthSlider.max;
    const percentage = ((val - min) / (max - min)) * 100;
    lengthSlider.style.setProperty('--value', `${percentage}%`);
  };

  const syncLength = (val) => {
    let value = parseInt(val, 10);
    const { min, max } = modeConfig[currentMode];
    if (isNaN(value)) value = min;
    if (value < min) value = min;
    if (value > max) value = max;
    
    lengthSlider.value = value;
    lengthInput.value = value;
    updateSliderBackground();
    generatePassword();
  };

  // --- Password Generation Logic ---

  const generateRandomPassword = (length, useNum, useSym) => {
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const nums = "0123456789";
    const syms = "!@#$%^&*()_+~`|}{[]:;?><,./-=";

    let chars = lower + upper;
    let guaranteed = [
      lower[getRandomInt(lower.length)],
      upper[getRandomInt(upper.length)]
    ];

    if (useNum) {
      chars += nums;
      guaranteed.push(nums[getRandomInt(nums.length)]);
    }
    if (useSym) {
      chars += syms;
      guaranteed.push(syms[getRandomInt(syms.length)]);
    }

    let pwd = "";
    // Fill the rest of the length with random characters from the allowed set
    for (let i = guaranteed.length; i < length; i++) {
      pwd += chars[getRandomInt(chars.length)];
    }

    // Add guaranteed characters
    pwd += guaranteed.join('');

    // Shuffle the result to ensure guaranteed characters aren't always at the end
    return pwd.split('').sort(() => 0.5 - Math.random()).join('');
  };

  const generateMemorablePassword = (count, capitalize, fullWords) => {
    const sourceArray = fullWords ? words : syllables;
    let parts = [];
    
    for (let i = 0; i < count; i++) {
      let word = sourceArray[getRandomInt(sourceArray.length)];
      if (capitalize) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
      }
      parts.push(word);
    }
    
    return parts.join('-');
  };

  const generatePinPassword = (length) => {
    const nums = "0123456789";
    let pwd = "";
    for (let i = 0; i < length; i++) {
      pwd += nums[getRandomInt(nums.length)];
    }
    return pwd;
  };

  // HTML Formatter for highlighting
  const formatPassword = (pwd, mode) => {
    if (mode === 'pin') {
      return `<span class="char-number">${pwd}</span>`;
    }
    
    if (mode === 'memorable') {
      // Numbers and symbols are rare in memorable unless injected, but typically just hyphens.
      // 1Password doesn't heavily highlight memorable parts, maybe just hyphens as symbols.
      return pwd.replace(/-/g, '<span class="char-symbol">-</span>');
    }

    // Random mode: highlight numbers and symbols
    let html = '';
    for (let i = 0; i < pwd.length; i++) {
      const char = pwd[i];
      if (/[0-9]/.test(char)) {
        html += `<span class="char-number">${char}</span>`;
      } else if (/[^a-zA-Z0-9]/.test(char)) {
        html += `<span class="char-symbol">${char}</span>`;
      } else {
        html += `<span class="char-letter">${char}</span>`;
      }
    }
    return html;
  };

  const generatePassword = () => {
    let pwd = "";
    const len = parseInt(lengthSlider.value, 10);

    if (currentMode === 'random') {
      pwd = generateRandomPassword(len, optNumbers.checked, optSymbols.checked);
    } else if (currentMode === 'memorable') {
      pwd = generateMemorablePassword(len, optCapitalize.checked, optFullwords.checked);
    } else if (currentMode === 'pin') {
      pwd = generatePinPassword(len);
    }

    passwordOutput.innerHTML = formatPassword(pwd, currentMode);
    
    // Reset copy button state
    btnCopy.textContent = "复制密码";
    btnCopy.classList.remove('success');
  };

  // --- Event Listeners ---

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      // Update UI
      tabs.forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      currentMode = e.currentTarget.dataset.type;

      // Show/hide options
      optionsRandom.classList.add('hidden');
      optionsMemorable.classList.add('hidden');
      optionsPin.classList.add('hidden');

      if (currentMode === 'random') optionsRandom.classList.remove('hidden');
      else if (currentMode === 'memorable') optionsMemorable.classList.remove('hidden');
      else if (currentMode === 'pin') optionsPin.classList.remove('hidden');

      // Update slider constraints
      const config = modeConfig[currentMode];
      lengthSlider.min = config.min;
      lengthSlider.max = config.max;
      lengthInput.min = config.min;
      lengthInput.max = config.max;
      
      syncLength(config.default);
    });
  });

  // Slider and Input changes
  lengthSlider.addEventListener('input', (e) => {
    lengthInput.value = e.target.value;
    updateSliderBackground();
    generatePassword();
  });

  lengthInput.addEventListener('change', (e) => syncLength(e.target.value));
  
  // To update on every keystroke if needed, but 'change' is safer for min/max logic
  lengthInput.addEventListener('input', (e) => {
    // only update background visually, actual generation on 'change' or valid input
    if (e.target.value >= lengthSlider.min && e.target.value <= lengthSlider.max) {
        lengthSlider.value = e.target.value;
        updateSliderBackground();
        generatePassword();
    }
  });

  // Options toggles
  [optNumbers, optSymbols, optCapitalize, optFullwords].forEach(opt => {
    opt.addEventListener('change', generatePassword);
  });

  // Action buttons
  btnRefresh.addEventListener('click', generatePassword);

  btnCopy.addEventListener('click', () => {
    const pwdText = passwordOutput.textContent;
    navigator.clipboard.writeText(pwdText).then(() => {
      btnCopy.textContent = "已复制！";
      btnCopy.classList.add('success');
      setTimeout(() => {
        btnCopy.textContent = "复制密码";
        btnCopy.classList.remove('success');
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  });

  // Initialize
  syncLength(modeConfig.random.default);
});
