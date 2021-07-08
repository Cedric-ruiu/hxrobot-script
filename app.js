// import {Papa} from 'papaparse';
let Papa = require('papaparse');

class Strategy {
    strategy; // DOM element
    indicators; // DOM element
    indicator; // DOM element
    parameters = []; // array of Object Parameters
    results = []; // raw storage of backtests results
    infos = {}; // raw storage of strategy info
    estimateTimeByTest = 13000; // duration estimation for one backtest (server side)
    overloadTime = 30000; // max timing allowed to waiting a backtest
    intervalTime = 500; // interval time to check when server respond a backtest
    jumpBacktests = 0; // start backtests after un specific number of tests
    backtestNumber = 0; // number of processed backtests (with jumped)
    debug = false;

    constructor(strategy) {
        if (typeof strategy === 'string') {
            this.strategy = document.getElementById(strategy);
        } else if (typeof strategy === 'number') {
            this.strategy = document.querySelectorAll('.strategy')[strategy]
        } else {
            this.strategy = strategy;
        }

        this.interfaceDecorator('available');

        if(!this.strategy.querySelector('.indicators')) {
            console.error('indicators panel is closed. Opening it before...');
        }
    };

    interfaceDecorator(state) {
        switch (state) {
            case 'available':
                this.strategy.style.border = '3px dashed rgba(20, 240, 20, 0.8)';
                break;
            case 'lock':
                this.strategy.style.border = '3px dashed #ff25ab';
                break;
            default:
                break;
        }
    }

    /**
     * strategy.init({3: {max: 5}, 5: {ignore: true}})
     * options[1].ignore = false;
     * options[1].min = 'auto'; // or float | false
     * options[1].max = 'auto'; // or float | false
     * options[1].increment = 'auto'; // or float | false
     *  
     * @param {*} options 
     * @returns 
     */
    init(options = {}) {
        if (!this.strategy.querySelector('.indicators')) {
            console.error('indicators panel is closed. Opening it before...');
            return;
        }

        this.reset();

        this.options = options;

        // indicators panel
        this.indicators = this.strategy.querySelector('.indicators');
        
        this.infos = this.collectInfos();

        // get indicator element
        this.indicator = this.indicators.querySelector('.indicator');

        // get all the parameters elements
        const parametersDOM = this.indicator.querySelectorAll('.element');
        
        // init each parameter with custom options
        // hidden parameters will be ignored
        let gap = 0;
        for (let i = 0; i < parametersDOM.length; i++) {
            if (parametersDOM[i].style.display === 'none') {
                gap++;
            } else {
                let parameterOptions = {};
                if (typeof this.options[i - gap] !== 'undefined') {
                    parameterOptions = this.options[i - gap];
                }
                this.parameters.push(new Parameter(parametersDOM[i], parameterOptions));
            }
        }

        if (options.jumpBacktests) {
            this.jumpBacktests = options.jumpBacktests;
        }

        if (options.debug) {
            this.debug = options.debug;
        }

        this.preCalculate();
    }

    async start() {
        // UI lock
        this.interfaceDecorator('lock');

        // reset all parameters and force saveResults
        // avoid case of ignored first test because nothing to validate
        this.resetParameters();
        if(!await this.validate()) this.saveResults();

        // start all backtests, first will be ignored
        await this.backtest()

        // start process to export data
        this.exportResults();
        
        // UI unlock
        this.interfaceDecorator('available');
    };

    reset() {
        this.indicators = this.indicator = '';
        this.parameters = [];
        this.options = {};
        this.infos = {
            timeframe: '',
            currency: '',
            earningCurrency: '',
            currentIndicator: '',
            associateIndicator: [],
        }
        this.jumpBacktests = 0;
        this.backtestNumber = 0;
        this.debug = false;
    }

    resetParameters() {
        if (this.debug) console.log('-> Strategy reset');
        this.parameters.forEach(parameter => {
            parameter.reset();
        });
    }

    async validate() {
        if (this.debug) console.log('-> Strategy start validate');
        const validated = await new Promise(resolve => {
            setTimeout(() => {
                if (this.strategy.querySelector('.overlay').style.display === 'none') {
                    // nothing to validate
                    console.warn('nothing to validate');
                    resolve(false);
                    return;
                }

                this.strategy.querySelector('.perf .pill.save').click();
                
                resolve(true);
                return;
            }, 1000);
        });

        if (validated) {
            await this.validateWaiting();
        } else {
            return false;
        }

        if (this.debug) console.log('-> Strategy end validate');

        return true;
    }

    async validateWaiting(autoSave = true) {
        return await new Promise(resolve => {
            const interval = setInterval(() => {
                let duration = 0;
                if (this.strategy.querySelector('.perf-stats .stat-perf') !== null) {
                    if (autoSave) this.saveResults();
                    resolve(true);
                    clearInterval(interval);
                    return true;
                } else if(this.overloadTime < duration) {
                    // over timing, stop all
                    throw new Error(`overload time (${this.overloadTime / 1000}s), stopping backtests...`);
                }
                duration += this.intervalTime;
            }, this.intervalTime);
        });
    }

    async backtest(paramIndex = 0) {
        if (this.debug) console.log(`-> Strategy backtest [${paramIndex}]`);

        if (!this.parameters[paramIndex].options.ignore) {
            if (this.debug) console.log(`--> parameter[${paramIndex}] to work x${this.parameters[paramIndex].count}`);
            for (let i = 0; i < this.parameters[paramIndex].count; i++) {
                if (this.debug) console.log(`--> parameter[${paramIndex}] in for i = [${i}] set increment`);
                this.parameters[paramIndex].incrementValue(i);

                if (paramIndex + 1 < this.parameters.length) {
                    if (this.debug) console.log(`--> parameter[${paramIndex}] go to parameter[${paramIndex + 1}]`);
                    await this.backtest(paramIndex + 1);
                } else {
                    if (this.debug) console.log(`--> parameter[${paramIndex}] validate`);
                    if (!this.jumpBacktests || this.jumpBacktests < this.backtestNumber) {
                        await this.validate();
                    }
                    this.backtestNumber++;
                }
            }
    
            if (this.debug) console.log(`--> parameter[${paramIndex}] reset`);
            this.parameters[paramIndex].reset();
        } else if (paramIndex + 1 < this.parameters.length) {
            if (this.debug) console.log(`--> parameter[${paramIndex}] ignored, go to parameter[${paramIndex + 1}]`);
            await this.backtest(paramIndex + 1);
        } else {
            if (this.debug) console.log(`--> parameter[${paramIndex}] ignored, that last, go validate`);
            if (!this.jumpBacktests || this.jumpBacktests < this.backtestNumber) {
                await this.validate();
            }
            this.backtestNumber++;
        }
        
        if (this.debug) console.log(`--> parameter[${paramIndex}] finished`);
        return true;
    }

    // MANAGE STATS

    collectInfos() {
        const indics = [];
        document.querySelectorAll('.indicator-title .name:not(.selected)').forEach(indic => indics.push(indic.outerText));

        return {
            timeframe: document.querySelector('.contests .choice2.selected').outerText.trim(),
            currency: document.querySelector('.contests .choice3.selected').outerText.trim(),
            earningCurrency: document.querySelector('.category-rm .vue-js-switch.toggled') ? 'BTC' : 'HXRO',
            currentIndicator: this.indicators.querySelector('.indicator-title .name.selected').outerText.trim(),
            associateIndicator: indics,
        }
    }

    preCalculate() {
        let countTests = 1;
        let countCursor = 0;
        this.parameters.forEach(parameter => {
            if(!parameter.options.ignore) {
                countTests *= parameter.count;
                countCursor += parameter.count;
            }
        });

        const totalTime = this.estimateTimeByTest * countTests;

        if (0 < this.jumpBacktests) {
            const countRemainingTest = countTests - this.jumpBacktests;
            const remainingTime = totalTime - (this.jumpBacktests * this.estimateTimeByTest)
            console.log(`
                --BACKTEST EVALUATION--
                indicator: ${this.infos.currentIndicator} (${this.parameters.length} parameters with ${countCursor} cursors)
                number of tests: ${countRemainingTest} (total: ${countTests} // jump to: ${this.jumpBacktests})
                estimate time to full backtest indicator: ${this.msToTime(remainingTime)} (total: ${this.msToTime(totalTime)})
                estimate ending time: ${new Date(new Date().getTime() + remainingTime).toLocaleString()}
            `);
        } else {
            console.log(`
                --BACKTEST EVALUATION--
                indicator: ${this.infos.currentIndicator} (${this.parameters.length} parameters with ${countCursor} cursors)
                number of tests: ${countTests}
                estimate time to full backtest indicator: ${this.msToTime(totalTime)}
                estimate ending time: ${new Date(new Date().getTime() + totalTime).toLocaleString()}
            `);
        }
    }

    saveResults() {
        if (this.debug) console.log('-> Strategy save results');
        const additionalData = [];
        additionalData['date'] = new Date().toLocaleString();
        this.results.push({...additionalData, ...this.getPerfData(), ...this.getParamData()})
    }

    exportResults() {
        if (this.debug) console.log('-> Strategy export results');
        const fileDate = new Date().toISOString().slice(0, 10);
        const filename = `${fileDate}_${this.infos.currentIndicator}-${this.infos.currency}-${this.infos.timeframe}.csv`;
        // Make CSV with PapaParse
        const csv = Papa.unparse(this.results);
        const blob = new Blob([csv]);
        const a = window.document.createElement("a");
        a.href = window.URL.createObjectURL(blob, {type: "text/plain"});
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    
    getPerfData() {
        const perfPanel = this.strategy.querySelectorAll('.perf-stats .stat-perf');
        const perfData = [];
        perfData['earning'] = parseFloat(perfPanel[0].querySelectorAll('div')[1].childNodes[0].nodeValue.trim().replace(/[^\d.-]/g, ''));
        perfData['winrate'] = parseFloat(perfPanel[2].querySelector('.number').outerText.replace(/[^\d.-]/g, ''));
        perfData['payout'] = parseFloat(perfPanel[3].querySelector('.number').outerText.replace(/[^\d.-]/g, ''));
        perfData['drawdown'] = parseFloat(perfPanel[5].querySelector('.number').outerText);
        perfData['ratio'] = parseFloat(0 < perfData['earning'] ? perfData['earning'] / (Math.abs(perfData['drawdown']) !== 0 ? Math.abs(perfData['drawdown']): 1) : 0).toFixed(2);
        perfData['trades'] = parseInt(perfPanel[6].querySelector('.number').outerText);
        perfData['winstreak'] = parseInt(perfPanel[7].querySelector('.number').outerText);
        perfData['losestreak'] = parseInt(perfPanel[8].querySelector('.number').outerText);
        perfData['pool'] = parseInt(perfPanel[4].querySelector('.number').outerText);
        return perfData;
    }

    getParamData() {
        const paramData = [];
        this.parameters.forEach(parameter => {
            paramData[parameter.name] = parameter.getCurrent();
        });
        return paramData;
    }

    // UTILS

    msToTime(ms) {
        let seconds = (ms / 1000).toFixed(1);
        let minutes = (ms / (1000 * 60)).toFixed(1);
        let hours = (ms / (1000 * 60 * 60)).toFixed(1);
        let days = (ms / (1000 * 60 * 60 * 24)).toFixed(1);
        if (seconds < 60) return seconds + " Sec";
        else if (minutes < 60) return minutes + " Min";
        else if (hours < 24) return hours + " Hrs";
        else return days + " Days"
    }

    debug() {
        console.log(
            '--INDICATOR: ' + this.infos.currentIndicator + '\n' +
            'countParameters: ' + this.parameters.length
        );
        this.parameters.forEach(parameter => {
            parameter.debug();
        });
    }
}

class Parameter {
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

    constructor(elementDOM, options = {}) {
        this.parameterDOM = elementDOM;
        this.name = this.parameterDOM.querySelector('.element-title').outerText;
        
        if (this.parameterDOM.querySelector('.input-false')) {
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
                // TODO: type optionalSlider
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
                // TODO: type optionalSlider
                break;
        }
    }

    getCurrent() {
        switch (this.type) {
            case 'switch':
                return this.switchDOM.classList.contains('toggled');
        
            case 'slider':
                return parseFloat(this.sliderDotDOM.getAttribute('aria-valuenow'));

            case 'select':
                return this.selectDOM.selectedIndex;

            case 'optionalSlider':
                // TODO: type optionalSlider
                // return break;
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
                // TODO: type optionalSlider
                break;
        }
    }

    // SLIDER

    sliderInit(options = {}) {
        this.type = 'slider';
        this.sliderDOM = this.parameterDOM.querySelector('.vue-slider');
        this.sliderDotDOM = this.parameterDOM.querySelector('.vue-slider-dot');
        this.inputDOM = this.parameterDOM.querySelector('input');
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
            if (this.max < this.options.increment || this.options.increment < this.increment) {
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
        for (let index = this.min; index <= this.max; index = this.cleanFloat(index+this.increment)) {
            this.count++;
        }
    }

    sliderReset() {
        if(this.type !== 'slider') return false;

        if(this.getCurrent() !== this.min) {
            this.sliderSetValue(this.min);
        }
    }

    sliderSetValue(value) {
        if(this.type !== 'slider') return false;

        this.sliderDOM.__vue__.setValue(value);
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

    sliderIncrement(cursor = 'auto') {
        let incrementalValue = 0;
        if (cursor === 'auto') {   
            // if (this.debug) console.log(`-> Parameter increment slider (auto) ${this.getCurrent()} + ${this.increment}`);
            incrementalValue = this.getCurrent() + this.increment;
        } else {
            // if (this.debug) console.log(`-> Parameter increment slider (cursor ${cursor}) ${this.min} + (${this.increment} * ${cursor})`);
            incrementalValue = this.min + (this.increment * cursor);
        }

        incrementalValue = this.cleanFloat(incrementalValue);

        if (incrementalValue <= this.max) {
            this.sliderSetValue(incrementalValue);
        } else {
            console.warn(`bad increment ${this.getCurrent()} + ${this.increment} for a max ${this.max} (${this.name})`);
        }
    }

    // SWITCH

    switchInit(options = {}) {
        this.type = 'switch';
        this.count = 2;
        this.switchDOM = this.parameterDOM.querySelector('.vue-js-switch');
        this.options = {...this.optionsDefault, ...options};

        if (typeof options.min !== 'undefined') {
            console.warn(`
                parameter: '${this.name}'
                'min' options at '${options.min}' isn't supported on switch
                (option ignored)
            `);
        }

        if(typeof options.max !== 'undefined') {
            console.warn(`
                parameter: '${this.name}'
                'max' options at '${options.max}' isn't supported on switch
                (option ignored)
            `);
        }

        if (typeof options.increment !== 'undefined') {
            console.warn(`
                parameter: '${this.name}'
                'increment' options '${options.increment}' isn't supported on switch
                (option ignored)
            `);
        }
    }

    switchReset() {
        if (this.type !== 'switch') return false;

        this.switchSetValue(false);
    }

    switchSetValue(value = 'auto') {
        if (this.type !== 'switch') return false;

        if (value === 'auto'
            || (value && !this.switchDOM.classList.contains('toggled'))
            || (!value && this.switchDOM.classList.contains('toggled'))) {
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
        if (this.type !== 'select') return false;

        this.selectSetValue(this.min);
    }

    selectSetValue(value) {
        if (this.type !== 'select') return false;

        // set value
        this.selectDOM.selectedIndex = parseInt(value);

        // event to refresh form vuejs
        const evt = document.createEvent("HTMLEvents");
        evt.initEvent("change", false, true);
        this.selectDOM.dispatchEvent(evt);
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

    selectIncrement(cursor) {
        // if (this.debug) console.log(`-> Parameter increment select (cursor ${cursor}) ${this.min} + (${this.increment} * ${cursor})`);
        const incrementalValue = this.min + (this.increment * cursor);
        if (incrementalValue <= this.max) {
            this.selectSetValue(incrementalValue);
        } else {
            console.warn(`bad select increment ${this.getCurrent()} + ${this.increment} for a max ${this.max} (${this.name})`);
        }
    }

    // OPTIONAL SLIDER (SWITCH + SLIDER)

    optionalSliderInit() {

    }

    optionalSliderReset() {

    }

    optionalSliderSetValue() {

    }

    optionalSliderDebug() {
        
    }

    optionalSliderIncrement() {
        
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

//const strategy = new Strategy(document.querySelector('.strategy'));
let strategy = new Strategy(0);

// strategy.init({
//     0: {ignore: true},
//     1: {ignore: true},
//     2: {ignore: true},
//     3: {increment: 1, min: 2, max: 3},
//     4: {increment: 1, min: 2, max: 3},
//     5: {ignore: true},
//     jumpBacktests: 1255,
// })

// strategy.start();
