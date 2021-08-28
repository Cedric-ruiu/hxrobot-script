export class Parameter {
    parameterDOM
    name;
    type;
    sliderDOM;
    sliderDotDOM;
    inputDOM;
    current;
    min;
    max;
    increment;
    switchDOM;
    count;
    options;
    optionsDefault = {
        ignore: false,
        min: 'auto',
        max: 'auto',
        increment: 'auto',
    };
    countMaxIncrement = 10;
    incrementDecimals = 0; // only for slider
    debug = false;

    constructor(elementDOM, options = {}, debug = false) {
        this.debug = debug;
        this.parameterDOM = elementDOM;
        this.name = this.parameterDOM.querySelector('.element-title').innerText;
        
        // parameter type detection 
        if (this.parameterDOM.querySelector('.element-input+.element-input')) {
            this.name += ' (' + this.parameterDOM.querySelector('.input-true').innerText + ')';
            this.optionalSliderInit(options);
        } else if (this.parameterDOM.querySelector('.vue-js-switch')) {
            this.switchInit(options);
        } else if (this.parameterDOM.querySelector('.vue-slider')) {
            this.sliderInit(options);
        } else if (this.parameterDOM.querySelector('select.option')) {
            this.selectInit(options);
        } else {
            console.error('unknown parameter');
            console.error(this.parameterDOM);
        }
    }

    reset() {
        if (this.options.ignore) return;
        
        switch (this.type) {
            case 'switch':
                this.switchReset();
                break;
        
            case 'slider':
                this.sliderReset();
                break;

            case 'select':
                this.selectReset();
                break;

            case 'optionalSlider':
                this.optionalSliderReset();
                break;
        }
    }

    debug() {
        switch (this.type) {
            case 'switch':
                this.switchDebug();
                break;
        
            case 'slider':
                this.sliderDebug();
                break;

            case 'select':
                this.selectDebug();
                break;

            case 'optionalSlider':
                this.optionalSliderDebug();
                break;
        }
    }

    getCurrent() {
        switch (this.type) {
            case 'switch':
                return this.switchGetCurrent();
        
            case 'slider':
                return this.sliderGetCurrent();

            case 'select':
                return this.selectGetCurrent();

            case 'optionalSlider':
                return this.optionalSliderGetCurrent();
        }
    }

    incrementValue(cursor) {
        if (this.options.ignore) return;

        switch (this.type) {
            case 'switch':
                this.switchSetValue(Boolean(cursor));
                break;
        
            case 'slider':
                this.sliderIncrement(cursor);
                break;

            case 'select':
                this.selectIncrement(cursor);
                break;

            case 'optionalSlider':
                this.optionalSliderIncrement(cursor);
                break;
        }
    }

    // SLIDER

    sliderInit(options = {}) {
        this.type = 'slider';
        this.sliderDOM = this.parameterDOM.querySelector('.vue-slider');
        this.sliderDotDOM = this.parameterDOM.querySelector('.vue-slider-dot');
        this.inputDOM = this.parameterDOM.querySelector('input[type="number"]:not([disabled])');
        this.options = {...this.optionsDefault, ...options};

        // default values
        if(this.inputDOM) {
            this.min = parseFloat(this.inputDOM.getAttribute('min'));
            this.max = parseFloat(this.inputDOM.getAttribute('max'));
            this.increment = parseFloat(this.inputDOM.getAttribute('step'));
        } else {
            // timeline without input
            this.min = parseFloat(this.sliderDotDOM.getAttribute('aria-valuemin'));
            this.max = parseFloat(this.sliderDotDOM.getAttribute('aria-valuemax'));
            this.increment = 1;
        }

        // override min values from options
        if (this.options.min || this.options.min === 0) {
            if (this.options.min < this.min || this.max < this.options.min) {
                console.warn(`
                    parameter: '${this.name}'
                    'min' options at '${this.options.min}' must between '${this.min}' and '${this.max}'
                    (option ignored)
                `);
            } else if (this.options.min === 'auto') {
                this.min = this.min + this.increment;
            } else {
                this.min = this.options.min;
            }
        }

        // override max values from options
        if(this.options.max || this.options.max === 0) {
            if (this.max < this.options.max || this.options.max < this.min) {
                console.warn(`
                    parameter: '${this.name}'
                    'max' options at '${this.options.max}' must between '${this.min}' and '${this.max}'
                    (option ignored)
                `);
            } else if (this.options.max === 'auto') {
                this.max = this.max - this.increment;
            } else {
                this.max = this.options.max;
            }
        }

        // override increment value from options
        if (this.options.increment || this.options.increment === 0) {
            if (this.options.increment < this.increment) {
                console.warn(`
                    parameter: '${this.name}'
                    'increment' options '${this.options.increment}' isn't set correctly (increment: ${this.increment})
                    (option ignored)
                `);
            } else if (this.options.increment === 'auto') {
                const countIncrement = (this.max - this.min + this.increment) / this.increment;
                if(this.countMaxIncrement < countIncrement) {
                    this.increment = Math.round(countIncrement / this.countMaxIncrement) * this.increment;
                }
            } else {
                this.increment = this.options.increment;
            }
        }

        this.incrementDecimals = this.countDecimals(this.increment);

        this.count = 0;
        for (let index = this.min; index <= this.max; index = this.cleanFloat(index + this.increment)) {
            this.count++;
        }
    }

    sliderReset() {
        if(this.getCurrent() !== this.min) {
            this.sliderSetValue(this.min);
        }
    }

    sliderGetCurrent() {
        return parseFloat(this.sliderDotDOM.getAttribute('aria-valuenow'));
    }

    sliderSetValue(value) {
        this.sliderDOM.__vue__.setValue(value);
    }

    sliderIncrement(cursor = 'auto') {
        let incrementalValue = 0;
        if (cursor === 'auto') {   
            if (this.debug) console.log(`-> Parameter increment slider (auto) ${this.getCurrent()} + ${this.increment}`);
            incrementalValue = this.getCurrent() + this.increment;
        } else {
            if (this.debug) console.log(`-> Parameter increment slider (cursor ${cursor}) ${this.min} + (${this.increment} * ${cursor})`);
            incrementalValue = this.min + (this.increment * cursor);
        }

        incrementalValue = this.cleanFloat(incrementalValue);

        if (incrementalValue <= this.max) {
            this.sliderSetValue(incrementalValue);
        } else {
            console.warn(`bad increment ${this.getCurrent()} + ${this.increment} for a max ${this.max} (${this.name})`);
        }
    }

    sliderDebug() {
        console.log(
            '--PARAMETER: ' + this.name + '\n' +
            'type: ' + this.type + '\n' +
            'min: ' + this.min + '\n' +
            'max: ' + this.max + '\n' +
            'increment: ' + this.increment + '\n' +
            'count: ' + this.count
        );
        console.log(this.sliderDOM);
    }

    // SWITCH

    switchInit(options = {}) {
        this.type = 'switch';
        this.count = 2;
        this.switchDOM = this.parameterDOM.querySelector('.vue-js-switch');
        this.options = {...this.optionsDefault, ...options};
    }

    switchReset() {
        this.switchSetValue(false);
    }

    switchGetCurrent() {
        return this.switchDOM.classList.contains('toggled');
    }

    switchSetValue(value = 'auto') {
        if (this.debug) console.log(`-> Parameter switchSetValue (${value}) ${this.switchGetCurrent()}`);
        if (value === 'auto'
            || (value && !this.switchGetCurrent())
            || (!value && this.switchGetCurrent())) {
            this.switchDOM.click();
        }
    }

    switchDebug() {
        console.log(
            '--PARAMETER: ' + this.name + '\n' +
            'type: ' + this.type + '\n' +
            'current: ' + this.getCurrent() + '\n' +
            'count: ' + this.count
        );
        console.log(this.switchDOM);
    }

    // SELECT

    selectInit(options = {}) {
        this.type = 'select';
        this.selectDOM = this.parameterDOM.querySelector('select.option');
        this.count = this.selectDOM.querySelectorAll('option').length;
        this.options = {...this.optionsDefault, ...options};
        this.min = 0;
        this.max = this.count;
        this.increment = 1;
    }

    selectReset() {
        this.selectSetValue(this.min);
    }

    selectGetCurrent() {
        return this.selectDOM.selectedIndex;
    }

    selectSetValue(value) {
        // set value
        this.selectDOM.selectedIndex = parseInt(value);

        // event to refresh form vuejs
        const evt = document.createEvent("HTMLEvents");
        evt.initEvent("change", false, true);
        this.selectDOM.dispatchEvent(evt);
    }

    selectIncrement(cursor) {
        const incrementalValue = this.min + (this.increment * cursor);
        if (incrementalValue <= this.max) {
            this.selectSetValue(incrementalValue);
        } else {
            console.warn(`bad select increment ${this.getCurrent()} + ${this.increment} for a max ${this.max} (${this.name})`);
        }
    }

    selectDebug() {
        console.log(
            '--PARAMETER: ' + this.name + '\n' +
            'type: ' + this.type + '\n' +
            'current: ' + this.getCurrent() + '\n' +
            'count: ' + this.count
        );
        console.log(this.selectDOM);
    }

    // OPTIONAL SLIDER (SWITCH + SLIDER)

    optionalSliderInit(options = {}) {
        this.switchDOM = this.parameterDOM.querySelector('.vue-js-switch');
        if (!this.switchGetCurrent()) {
            this.switchSetValue(true); //enable switch to access slider
        }
        this.sliderInit(options);
        this.type = 'optionalSlider';
        this.count++; // +1 to add off switch cursor
        this.options = {...this.optionsDefault, ...options};
    }

    optionalSliderReset() {
        this.switchSetValue(true); //enable switch to access slider
        this.sliderReset();
        this.switchReset();
    }

    optionalSliderGetCurrent() {
        return this.switchGetCurrent() ? this.sliderGetCurrent() : false;
    }

    optionalSliderIncrement(cursor = 'auto') {
        if (cursor === 'auto') {
            if (this.switchGetCurrent()) {
                this.sliderIncrement(cursor);
            } else {
                this.switchSetValue(true);
            }
        } else if (cursor === 0) {
            this.switchSetValue(false);
        } else {
            this.switchSetValue(true);
            this.sliderIncrement(cursor - 1);
        }
    }

    optionalSliderDebug() {
        console.log(
            '--PARAMETER: ' + this.name + '\n' +
            'type: ' + this.type + '\n' +
            'current: ' + this.getCurrent() + '\n' +
            'count: ' + this.count
        );
        console.log(this.selectDOM);
    }

    // Utils

    // https://stackoverflow.com/questions/17369098/simplest-way-of-getting-the-number-of-decimals-in-a-number-in-javascript
    cleanFloat(floatNumber) {
        floatNumber = floatNumber.toFixed(this.incrementDecimals);
        return parseFloat(floatNumber);
    }

    countDecimals(value) {
        if(Math.floor(value) === value) return 0;
        return value.toString().split(".")[1].length || 0; 
    }
}
