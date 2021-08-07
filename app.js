let Papa = require('papaparse');

class Strategy {
    label; // DOM element
    strategy; // DOM element
    indicators; // DOM element
    indicator; // DOM element
    parameters = []; // array of Object Parameters
    results = []; // raw storage of backtests results
    infos = {}; // raw storage of strategy info
    estimateTimeByTest = 13000; // duration estimation for one backtest (server side)
    overloadTime = 30000; // max timing allowed to waiting a backtest
    intervalTime = 500; // interval time to check when server respond a backtest
    jumpTestAfterStart = 0; // start backtests after un specific number of tests
    jumpTestStack = 0; // current stacking jump test
    jumpTestsParamByTrade = false; // jump all following cursor test for last slider indic if trade === value
    jumpTestsParamByEarning = false; // jump all following cursor test for last slider indic if earning smaller than value
    jumpTestByEarning = false; // jump one following cursor test for last slider indic if earning smaller than previous
    jumpTestByTrade = false; // jump one following cursor test for last slider indic if earning smaller than previous
    jumpTestByEarningMinus = false; // jump one following cursor test for last slider indic if earning smaller than previous
    backtestNumber = 0; // number of processed backtests (with jumped)
    backtestTotal = 0; // total of backtests
    debug = false;
    dateStart = 0;
    dateEnd = 0;

    constructor(strategy) {
        if (typeof strategy === 'string') {
            this.strategy = document.getElementById(strategy);
        } else if (typeof strategy === 'number') {
            this.strategy = document.querySelectorAll('.strategy')[strategy]
        } else {
            this.strategy = strategy;
        }

        this.interfaceDecorator('available');
        this.insertLabel();

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

    insertLabel() {
        this.label = this.strategy.querySelector('.cr-label');

        if (!this.label) {
            this.strategy.style.position = 'relative';

            const label = document.createElement("div");
            label.style.position = 'absolute';
            label.style.color = '#fff';
            label.style.top = '30px';
            label.style.left = '0';
            label.style.backgroundColor = 'rgba(20, 240, 20, 0.8)';
            label.style.padding = '5px 10px';
            label.style.zIndex = '5';
            label.classList.add('cr-label');

            this.strategy.appendChild(label);

            this.label = this.strategy.querySelector('.cr-label');
        }

        this.setLabel('script loaded');
    }

    setLabel(content) {
        this.label.innerHTML = content;
    }

    updateLabelProgress() {
        // show %
        let content = (this.backtestNumber / this.backtestTotal) * 100;
        content = Number.parseFloat(content).toFixed(1);
        content += '%';
        
        // show remaining time
        let remainingTime = '';
        if(this.backtestNumber === 0) {
            remainingTime = new Date(new Date().getTime() + (this.estimateTimeByTest * this.backtestTotal)).toLocaleString();
        } else {
            const estimateTimeByTest = (new Date().getTime() - this.dateStart) / this.backtestNumber;
            remainingTime = new Date(new Date().getTime() + (estimateTimeByTest * (this.backtestTotal - this.backtestNumber))).toLocaleString();
        }

        content += ` (${remainingTime})`;
        this.setLabel(content);
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

        if (options.jumpTestAfterStart) {
            this.jumpTestAfterStart = options.jumpTestAfterStart;
            this.jumpTestStack += this.jumpTestAfterStart;
        }

        if (typeof options.jumpTestsParamByTrade !== 'undefined') {
            this.jumpTestsParamByTrade = options.jumpTestsParamByTrade;
        }

        if (typeof options.jumpTestsParamByEarning !== 'undefined') {
            this.jumpTestsParamByEarning = options.jumpTestsParamByEarning;
        }

        if (typeof options.jumpTestByEarning !== 'undefined') {
            this.jumpTestByEarning = options.jumpTestByEarning;
        }

        if (typeof options.jumpTestByTrade !== 'undefined') {
            this.jumpTestByTrade = options.jumpTestByTrade;
        }

        if (typeof options.jumpTestByEarningMinus !== 'undefined') {
            this.jumpTestByEarningMinus = options.jumpTestByEarningMinus;
        }

        if (options.debug) {
            this.debug = options.debug;
        }

        this.preCalculate();
    }

    async start() {
        // Track time
        this.dateStart = new Date().getTime();

        // UI update start
        this.startInfo();

        // reset all parameters and force saveResults
        // avoid case of ignored first test because nothing to validate
        this.resetParameters();
        if(!await this.validate()) this.saveResults();

        // start all backtests, first will be ignored
        await this.backtest()

        // Track time
        this.dateEnd = new Date().getTime();

        // UI update end
        this.endInfo();

        // start process to export data
        this.exportResults();
    };

    startInfo() {
        this.interfaceDecorator('lock');
        this.setLabel(`0% - starting...`);

        console.log(`
            --BACKTEST STARTED--
            start time: ${new Date(this.dateStart).toLocaleString()}
            end time (estimate): ${new Date(new Date().getTime() + (this.estimateTimeByTest * this.backtestTotal)).toLocaleString()}
        `);
    }

    endInfo() {
        this.interfaceDecorator('available');
        this.setLabel(`100% - finish`);

        console.log(`
            --BACKTEST END--
            start time: ${new Date(this.dateStart).toLocaleString()}
            end time: ${new Date(this.dateEnd).toLocaleString()}
            tests: ${this.results.length}
            jumped tests: ${this.backtestTotal - (this.results.length)}
        `);
    }

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
        this.jumpTestAfterStart = 0;
        this.jumpTestStack = 0;
        this.jumpTestsParamByTrade = false;
        this.jumpTestsParamByEarning = false;
        this.jumpTestByEarning = false;
        this.jumpTestByTrade = false;
        this.jumpTestByEarningMinus = false;
        this.backtestNumber = 0;
        this.backtestTotal = 0;
        this.debug = false;
        this.results = [];
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

                await this.backtestParam(paramIndex);
            }
    
            if (this.backtestNumber < this.backtestTotal) {
                if (this.debug) console.log(`--> parameter[${paramIndex}] reset`);
                this.parameters[paramIndex].reset();
            }
        } else {
            if (this.debug) console.log(`--> parameter[${paramIndex}] ignored`);
            await this.backtestParam(paramIndex);
        }
        
        if (this.debug) console.log(`--> parameter[${paramIndex}] finished`);
        return true;
    }

    async backtestParam(paramIndex = 0) {
        if (paramIndex + 1 < this.parameters.length) {
            if (this.debug) console.log(`--> parameter[${paramIndex}] go to parameter[${paramIndex + 1}]`);
            await this.backtest(paramIndex + 1);
        } else {
            if (this.debug) console.log(`--> parameter[${paramIndex}] validate`);
            
            if (!this.jumpTestStack) {
                await this.validate();
                this.checkJumpTest();
            } else {
                this.jumpTestStack--;
            }
            
            this.backtestNumber++;
            this.updateLabelProgress();
        }

        return true;
    }

    // JUMP

    isJumpableParameter() {
        for (let i = this.parameters.length - 1; i >= 0; i--) {
            if (!this.parameters[i].options.ignore)  {
                if (this.parameters[i].type === 'slider') {
                    // search the last slider parameter not ignored
                    if ((this.parameters[i].getCurrent() + this.parameters[i].increment) <= this.parameters[i].max)  {
                        // not the last cursor in this parameter, jump value is possible
                        return i;
                    } else {
                        // we are on the last cursor, no jump
                        return false;
                    }
                } else {
                    // last active parameter isn't a slider
                    return false;
                }
            }
        }

        // active slider not found, no jump
        return false;
    }

    checkJumpTest() {
        // enough data to compare
        if (1 < this.results.length) {
            const jumpableParameter = this.isJumpableParameter();

            if (jumpableParameter) {
                const current = this.getCurrentResult();
                let jumped = false;

                // Priority 0
                if (this.jumpTestsParamByTrade !== false) {
                    jumped = this.checkJumpTestsParamByTrade(jumpableParameter, current);
                }

                // Priority 1
                if (!jumped && this.jumpTestsParamByEarning !== false) {
                    jumped = this.checkJumpTestsParamByEarning(jumpableParameter, current);
                }

                // Priority 2
                if (!jumped && this.jumpTestByEarning !== false) {
                    jumped = this.checkJumpTestByEarning(current);
                }

                // Priority 3
                if (!jumped && this.jumpTestByTrade !== false) {
                    jumped = this.checkJumpTestByTrade(current);
                }

                // Priority 4
                if (!jumped && this.jumpTestByEarningMinus !== false) {
                    const previous = this.getPreviousResult();
                    jumped = this.checkJumpTestByEarningMinus(current, previous);
                }
            }
        }
    }

    checkJumpTestsParamByTrade(jumpableParameter, current) {
        if (current.trades <= this.jumpTestsParamByTrade) {
            return this.jumpTestsParam(jumpableParameter);
        }

        return false;
    }

    checkJumpTestsParamByEarning(jumpableParameter, current) {
        if (current.earning <= this.jumpTestsParamByEarning) {
            return this.jumpTestsParam(jumpableParameter);
        }

        return false;
    }

    jumpTestsParam(jumpableParameter) {
        let jumped = false;
        // determine the number of cursor to jump
        for (
            let index = this.parameters[jumpableParameter].getCurrent();
            index <= this.parameters[jumpableParameter].max;
            index = this.parameters[jumpableParameter].cleanFloat(index + this.parameters[jumpableParameter].increment)
        ) {
            this.jumpTestStack++;
            jumped = true;
        }

        if (jumped) {
            this.jumpTestStack--; // remove the getCurrent test, because already tested
        }

        return jumped;
    }

    checkJumpTestByEarning(current) {
        if (current.earning <= this.jumpTestByEarning) {
            this.jumpTestStack++;
            return true;
        }

        return false;
    }

    checkJumpTestByTrade(current) {
        if (current.trades <= this.jumpTestByTrade) {
            this.jumpTestStack++;
            return true;
        }

        return false;
    }

    checkJumpTestByEarningMinus(current, previous) {
        if (current.earning <= this.jumpTestByEarningMinus && current.earning < previous.earning) {
            this.jumpTestStack++;
            return true;
        }

        return false;
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
        this.backtestTotal = 1;
        let countCursor = 0;
        this.parameters.forEach(parameter => {
            if(!parameter.options.ignore) {
                this.backtestTotal *= parameter.count;
                countCursor += parameter.count;
            }
        });

        const totalTime = this.estimateTimeByTest * this.backtestTotal;

        let evalIndicator,
            evalCountTest,
            evalEstimateDuringTime,
            evalEstimateEndingTime;

        if (0 < this.jumpTestAfterStart) {
            const countRemainingTest = this.backtestTotal - this.jumpTestAfterStart;
            const remainingTime = totalTime - (this.jumpTestAfterStart * this.estimateTimeByTest);
            evalIndicator = `${this.infos.currentIndicator} (${this.parameters.length} parameters with ${countCursor} cursors)`;
            evalCountTest = `${countRemainingTest} (total: ${this.backtestTotal} // jump to: ${this.jumpTestAfterStart})`;
            evalEstimateDuringTime = `${this.msToTime(remainingTime)} (total: ${this.msToTime(totalTime)})`;
            evalEstimateEndingTime = `${new Date(new Date().getTime() + remainingTime).toLocaleString()}`;
        } else {
            evalIndicator = `${this.infos.currentIndicator} (${this.parameters.length} parameters with ${countCursor} cursors)`;
            evalCountTest = `${this.backtestTotal}`;
            evalEstimateDuringTime = `${this.msToTime(totalTime)}`;
            evalEstimateEndingTime = `${new Date(new Date().getTime() + totalTime).toLocaleString()}`;
        }

        this.setLabel(`ready to start : ${evalEstimateEndingTime}`);

        console.log(`
            --BACKTEST EVALUATION--
            indicator: ${evalIndicator}
            number of tests: ${evalCountTest}
            estimate time to full backtest indicator: ${evalEstimateDuringTime}
            estimate ending time: ${evalEstimateEndingTime}
            (option) debug: ${this.debug}
            (option) jumpTestAfterStart: ${this.jumpTestAfterStart}
            (option) jumpTestsParamByTrade : ${this.jumpTestsParamByTrade}
            (option) jumpTestsParamByEarning : ${this.jumpTestsParamByEarning}
            (option) jumpTestByEarning : ${this.jumpTestByEarning}
            (option) jumpTestByTrade : ${this.jumpTestByTrade}
            (option) jumpTestByEarningMinus : ${this.jumpTestByEarningMinus}
        `);
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

    getCurrentResult() {
        return this.results[this.results.length - 1];
    }

    getPreviousResult() {
        return this.results[this.results.length - 2];
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
        for (let index = this.min; index <= this.max; index = this.cleanFloat(index + this.increment)) {
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

let strategy = new Strategy(0);
