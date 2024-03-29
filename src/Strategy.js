let Papa = require('papaparse');
import {Parameter} from './Parameter';
import {cleanFloat, msToTime, sleep} from './Utils';

export class Strategy {
    static version = '1.4.0';
    
    label; // DOM element
    strategy; // DOM element
    indicators; // DOM element
    indicator; // DOM element
    parameters = []; // array of Object Parameters
    results = []; // raw storage of backtests results
    infos = {}; // raw storage of strategy info
    
    estimateTimeByTest = 16000; // duration estimation for one backtest (server side)
    overloadTime = 60000; // max timing allowed to waiting a backtest
    intervalTime = 500; // interval time to check when server respond a backtest
    
    jumpTestAfterStart = 0; // start backtests after un specific number of tests
    jumpParamNumber = false; // choose a specific param to jump, by default this is the last
    jumpParamIndex = false; // save the parameter index who jump
    jumpTestStack = 0; // current stacking jump test
    jumpAuto = false;
    jumpAutoSeries = false;
    jumpTestsParamByTrade = false; // jump all following cursor test for last slider indic if trade === value
    jumpTestsParamByEarning = false; // jump all following cursor test for last slider indic if earning smaller than value
    jump3TestByEarning = false; // jump 3 tests by compare earning
    jump2TestByEarning = false; // jump 2 tests by compare earning
    jump1TestByEarning = false; // jump one test by compare earning
    jumpTestByTrade = false; // jump one test by compare trade
    jumpTestByWinrate = false; // jump one test by compare winrate
    jumpTestByEarningMinus = false; // jump one test for last slider indic if earning smaller than previous
    jumpedTest = {}; // list number of jumped backtests
    
    backtestNumber = 0; // number of processed backtests (with jumped)
    backtestTotal = 0; // total of backtests
    countOverloadTime = 0;
    debug = false;
    dateStart = 0;
    dateEnd = 0;
    started = false; // security check for a started BT

    jumpAutoConfig = {
        '5m': {
            jump1TestByEarning: 0,
            jump2TestByEarning: -1000,
            jump3TestByEarning: -3500,
            jumpTestByTrade: 20,
            jumpTestByWinrate: 52,
        },
        '15m': {
            jump1TestByEarning: 0,
            jump2TestByEarning: -400,
            jump3TestByEarning: -800,
            jumpTestByTrade: 15,
            jumpTestByWinrate: 52.5,
        }
    };

    jumpAutoSeriesConfig = {
        '5m': {
            jumpTestsParamByTrade: 0,
            jumpTestsParamByEarning: -5000,
        },
        '15m': {
            jumpTestsParamByTrade: 0,
            jumpTestsParamByEarning: -1200,
        }
    }

    constructor(strategy = null) {
        if (typeof strategy === 'number') {
            this.strategy = document.querySelectorAll('.strategy')[strategy]
        } else {
            return;
        }

        this.interfaceDecorator('available');
        this.insertLabel();

        if(!this.strategy.querySelector('.indicators')) {
            console.error('indicators panel is closed. Opening it before...');
        }
    };

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
        if (this.started) {
            console.warn('Strategy already started, use stop() method first');
            return;
        }

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
        
        // set debug mode
        if (options.debug) {
            this.debug = options.debug;
        }

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
                this.parameters.push(new Parameter(parametersDOM[i], parameterOptions, this.debug));
            }
        }

        if (options.jumpTestAfterStart) {
            this.jumpTestAfterStart = options.jumpTestAfterStart;
            this.jumpTestStack += this.jumpTestAfterStart;
        }

        // auto jump series - disabled by default
        if (typeof options.jumpAutoSeries !== 'undefined' && options.jumpAutoSeries) {
            if (typeof this.jumpAutoSeriesConfig[this.infos.timeframe] !== 'undefined') {
                options.jumpTestsParamByTrade = this.jumpAutoSeriesConfig[this.infos.timeframe].jumpTestsParamByTrade;
                options.jumpTestsParamByEarning = this.jumpAutoSeriesConfig[this.infos.timeframe].jumpTestsParamByEarning;
            }
        }

        if (typeof options.jumpTestsParamByTrade !== 'undefined') {
            this.jumpTestsParamByTrade = options.jumpTestsParamByTrade;
            this.jumpedTest.jumpTestsParamByTrade = 0;
        }

        if (typeof options.jumpTestsParamByEarning !== 'undefined') {
            this.jumpTestsParamByEarning = options.jumpTestsParamByEarning;
            this.jumpedTest.jumpTestsParamByEarning = 0;
        }

        // auto jump - enabled by default
        if (typeof options.jumpAuto === 'undefined' || options.jumpAuto) {
            if (typeof this.jumpAutoConfig[this.infos.timeframe] !== 'undefined') {
                options.jump3TestByEarning = this.jumpAutoConfig[this.infos.timeframe].jump3TestByEarning;
                options.jump2TestByEarning = this.jumpAutoConfig[this.infos.timeframe].jump2TestByEarning;
                options.jump1TestByEarning = this.jumpAutoConfig[this.infos.timeframe].jump1TestByEarning;
                options.jumpTestByTrade = this.jumpAutoConfig[this.infos.timeframe].jumpTestByTrade;
                options.jumpTestByWinrate = this.jumpAutoConfig[this.infos.timeframe].jumpTestByWinrate;
            }
        }

        if (typeof options.jump3TestByEarning !== 'undefined') {
            this.jump3TestByEarning = options.jump3TestByEarning;
            this.jumpedTest.jump3TestByEarning = 0;
        }

        if (typeof options.jump2TestByEarning !== 'undefined') {
            this.jump2TestByEarning = options.jump2TestByEarning;
            this.jumpedTest.jump2TestByEarning = 0;
        }

        if (typeof options.jump1TestByEarning !== 'undefined') {
            this.jump1TestByEarning = options.jump1TestByEarning;
            this.jumpedTest.jump1TestByEarning = 0;
        }

        if (typeof options.jumpTestByTrade !== 'undefined') {
            this.jumpTestByTrade = options.jumpTestByTrade;
            this.jumpedTest.jumpTestByTrade = 0;
        }

        if (typeof options.jumpTestByWinrate !== 'undefined') {
            this.jumpTestByWinrate = options.jumpTestByWinrate;
            this.jumpedTest.jumpTestByWinrate = 0;
        }

        if (typeof options.jumpTestByEarningMinus !== 'undefined') {
            this.jumpTestByEarningMinus = options.jumpTestByEarningMinus;
            this.jumpedTest.jumpTestByEarningMinus = 0;
        }

        if (this.jumpTestsParamByTrade !== false 
            || this.jumpTestsParamByEarning !== false
            || this.jump3TestByEarning !== false
            || this.jump2TestByEarning !== false
            || this.jump1TestByEarning !== false
            || this.jumpTestByTrade !== false
            || this.jumpTestByWinrate !== false
            || this.jumpTestByEarningMinus !== false) {
            if (this.options.jumpParamNumber) {
                this.jumpParamNumber = this.options.jumpParamNumber;
                // Swap the jump parameter at the last position
                if (this.parameters[this.jumpParamNumber].type === 'slider' || this.parameters[this.jumpParamNumber].type === 'optionalSlider') {
                    let lastParamNum = this.parameters.length - 1;
                    [this.parameters[this.jumpParamNumber], this.parameters[lastParamNum]] = [this.parameters[lastParamNum], this.parameters[this.jumpParamNumber]];
                    this.jumpParamIndex = lastParamNum;
                } else {
                    console.warn(`This parameter (${this.parameters[this.jumpParamNumber].name}) isn't a slider/optionalSlider type`);
                }
            } else {
                this.jumpParamIndex = this.getJumpParamIndex();
            }

            // UI mark
            if (this.jumpParamIndex) {
                this.parameters[this.jumpParamIndex].addMarkUI();
            }
        }

        this.preCalculate();
    }

    async start() {
        if (this.started) {
            console.warn('Strategy already started, use stop() method first');
            return;
        }

        this.started = true;

        // Track time
        this.dateStart = new Date().getTime();

        // UI update start
        this.startInfo();

        // reset all parameters
        this.resetParameters();

        // reset stop limit field with minimal value
        await this.incrementStopLimitField(10);

        // process backtests
        await this.backtest();

        // Track time
        this.dateEnd = new Date().getTime();

        // UI update end
        this.endInfo();

        // start process to export data
        this.exportResults();

        this.started = false;
    };

    stop() {
        this.started = false;

        console.group('--BACKTEST STOPPED--');
        console.log('To continue backtest, use same strat & init config, and add:');
        console.log('\tjumpTestAfterStart: ' + (this.backtestNumber + 1));
        console.log('waiting last test... If nothing hapening, tap:');
        console.log('\tstrategy.export.result()');
        console.groupEnd();
    }

    startInfo() {
        this.interfaceDecorator('lock');
        this.setLabel('0% - starting...');

        console.groupCollapsed('--BACKTEST STARTED--');
        console.table({
            startTime: new Date(this.dateStart).toLocaleString(),
            endTimeEstimate: new Date(new Date().getTime() + (this.estimateTimeByTest * this.backtestTotal)).toLocaleString(),
        });
        console.groupEnd();
    }

    endInfo() {
        this.interfaceDecorator('available');
        this.setLabel('100% - finish');

        let totalJumpedTest = 0;

        Object.entries(this.jumpedTest).forEach(([key, value]) => {
            totalJumpedTest += value;
        });

        if (0 < this.jumpTestAfterStart) {
            totalJumpedTest += this.jumpTestAfterStart;
            this.jumpedTest.jumpTestAfterStart = this.jumpTestAfterStart;
        }

        console.groupCollapsed('--BACKTEST END--');
        console.table({
            startTime: new Date(this.dateStart).toLocaleString(),
            endTime: new Date(this.dateEnd).toLocaleString(),
            TOTALoverloadTime: this.countOverloadTime,
            tests: this.results.length,
            TOTALjumpedTests: totalJumpedTest,
            ...this.jumpedTest
        });
        console.groupEnd();
    }

    reset() {
        if (this.jumpParamIndex) {
            this.parameters[this.jumpParamIndex].removeMarkUI();
        }
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
        this.jumpParamNumber = false;
        this.jumpParamIndex = false;
        this.jumpTestStack = 0;
        this.jumpTestsParamByTrade = false;
        this.jumpTestsParamByEarning = false;
        this.jump3TestByEarning = false;
        this.jump2TestByEarning = false;
        this.jump1TestByEarning = false;
        this.jumpTestByTrade = false;
        this.jumpTestByWinrate = false;
        this.jumpTestByEarningMinus = false;
        this.jumpedTest = {};
        this.countOverloadTime = 0;
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

        if (await this.validateClick()) {
            let backtestRespond = await this.validateWaiting();

            while (!backtestRespond && this.started) {
                if (this.debug) console.log('-> While force update');
                await this.incrementStopLimitField();
                await this.validateClick();
                backtestRespond = await this.validateWaiting();
            }

            // tricks: add 500 milliseconds to be sure that correct data is updated (drawdown)
            await sleep(500);
        }

        this.saveResults();

        if (this.debug) console.log('-> Strategy end validate');

        return true;
    }

    async validateClick() {
        await sleep(1000);

        if (this.strategy.querySelector('.overlay').style.display === 'none') {
            // nothing to validate
            console.warn('nothing to validate');
            return false;
        }

        this.strategy.querySelector('.perf .pill.save').click();

        return true;
    }

    async validateWaiting() {
        return await new Promise(resolve => {
            let duration = 0;
            const interval = setInterval(() => {
                if (this.strategy.querySelector('.graph').style.opacity === '1') {
                    resolve(true);
                    clearInterval(interval);
                    return true;
                } else if(this.overloadTime < duration) {
                    // overload timing, stop waiting
                    this.countOverloadTime++;
                    resolve(false);
                    clearInterval(interval);
                    console.warn(`${this.strategy.querySelector('.strategy-title').childNodes[0].innerText}: Overload time (${this.overloadTime / 1000}s) on BT n°${this.backtestNumber}, revalidate backtest...`);
                    return false;
                }
                duration += this.intervalTime;
            }, this.intervalTime);
        });
    }

    async backtest(paramIndex = 0) {
        if (!this.started) return false;
        if (this.debug) console.log(`-> Strategy backtest [${paramIndex}]`);

        if (!this.parameters[paramIndex].options.ignore) {
            if (this.debug) console.log(`--> parameter[${paramIndex}] to work x${this.parameters[paramIndex].count}`);
            for (let i = 0; i < this.parameters[paramIndex].count; i++) {
                if (this.debug) console.log(`--> parameter[${paramIndex}] in for i = [${i}] set increment`);

                // condition to fast jump with 'jumpTestAfterStart' 
                if (i < this.parameters[paramIndex].count - 1 || !this.jumpTestStack) {
                    this.parameters[paramIndex].incrementValue(i);
                }

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
        if (!this.started) return false;
        if (paramIndex + 1 < this.parameters.length) {
            if (this.debug) console.log(`--> parameter[${paramIndex}] go to parameter[${paramIndex + 1}]`);
            await this.backtest(paramIndex + 1);
        } else {
            if (this.debug) console.log(`--> parameter[${paramIndex}] validate`);
            
            if (!this.jumpTestStack) {
                await this.validate();
                this.addJump();
            } else {
                this.jumpTestStack--;
            }
            
            this.backtestNumber++;
            this.updateLabelProgress();
        }

        return true;
    }

    async incrementStopLimitField(value = false) {
        await this.prepareStopLimitField();
        
        // update value  input
        const inp = this.strategy.querySelector('.content-stop-limit input[type="number"]')
        const ev = new Event('input');
        if (value) {
            inp.value = parseInt(value);
        } else {
            inp.value = parseInt(inp.value) + 10;
        }
        inp.dispatchEvent(ev);
    }

    async prepareStopLimitField() {
        // click on stop limit
        this.strategy.querySelectorAll('.risk-management-container .title-right .name')[1].click();

        await sleep(500);

        // check toggled switch
        if (!this.strategy.querySelector('.content-stop-limit .vue-js-switch').classList.contains('toggled')) {
            // click on switch
            this.strategy.querySelector('.content-stop-limit .vue-js-switch').click()
        }
    }

    // JUMP

    getJumpParamIndex() {
        for (let i = this.parameters.length - 1; i >= 0; i--) {
            if (!this.parameters[i].options.ignore)  {
                if (this.parameters[i].type === 'slider' || this.parameters[i].type === 'optionalSlider') {
                    // search the last slider/optionalSlider parameter not ignored
                    return i;
                } else {
                    // last active parameter isn't a slider
                    return false;
                }
            }
        }

        // active slider not found, no jump
        return false;
    }

    addJump() {
        // enough data to compare
        if (this.jumpParamIndex && this.parameters[this.jumpParamIndex].isReadyToJump()) {
            const remainingCursor = this.parameters[this.jumpParamIndex].getRemainingCursor();
            if (remainingCursor) {
                const current = this.getCurrentResult();
                let jumped = false;

                // Priority 0
                if (this.jumpTestsParamByTrade !== false) {
                    jumped = this.checkJumpTestsParamByTrade(current);
                }

                // Priority 1
                if (!jumped && this.jumpTestsParamByEarning !== false) {
                    jumped = this.checkJumpTestsParamByEarning(current);
                }

                // Priority 2
                if (!jumped && this.jump3TestByEarning !== false && 3 <= remainingCursor) {
                    jumped = this.checkJump3TestByEarning(current);
                }

                // Priority 3
                if (!jumped && this.jump2TestByEarning !== false && 2 <= remainingCursor) {
                    jumped = this.checkJump2TestByEarning(current);
                }

                // Priority 4
                if (!jumped && this.jump1TestByEarning !== false) {
                    jumped = this.checkJump1TestByEarning(current);
                }

                // Priority 5
                if (!jumped && this.jumpTestByTrade !== false) {
                    jumped = this.checkJumpTestByTrade(current);
                }

                // Priority 6
                if (!jumped && this.jumpTestByWinrate !== false) {
                    jumped = this.checkJumpTestByWinrate(current);
                }

                // Priority 7
                if (!jumped && 1 < this.results.length && this.jumpTestByEarningMinus !== false) {
                    const previous = this.getPreviousResult();
                    jumped = this.checkJumpTestByEarningMinus(current, previous);
                }
            }
        }
    }

    checkJumpTestsParamByTrade(current) {
        if (current.trades <= this.jumpTestsParamByTrade) {
            return this.jumpTestsParam('jumpTestsParamByTrade');
        }

        return false;
    }

    checkJumpTestsParamByEarning(current) {
        if (current.earning <= this.jumpTestsParamByEarning) {
            return this.jumpTestsParam('jumpTestsParamByEarning');
        }

        return false;
    }

    jumpTestsParam(jumpName) {
        let jumped = false;
        // determine the number of cursor to jump
        for (
            let index = this.parameters[this.jumpParamIndex].getCurrent();
            index <= this.parameters[this.jumpParamIndex].max;
            index = cleanFloat(index + this.parameters[this.jumpParamIndex].increment, this.parameters[this.jumpParamIndex].incrementDecimals)
        ) {
            this.jumpTestStack++;
            this.jumpedTest[jumpName]++;
            jumped = true;
        }

        if (jumped) {
            // remove the getCurrent test, because already tested
            this.jumpTestStack--;
            this.jumpedTest[jumpName]--;
        }

        return jumped;
    }

    checkJump3TestByEarning(current) {
        if (current.earning <= this.jump3TestByEarning) {
            this.jumpTestStack += 3;
            this.jumpedTest.jump3TestByEarning += 3;
            return true;
        }

        return false;
    }

    checkJump2TestByEarning(current) {
        if (current.earning <= this.jump2TestByEarning) {
            this.jumpTestStack += 2;
            this.jumpedTest.jump2TestByEarning += 2;
            return true;
        }

        return false;
    }

    checkJump1TestByEarning(current) {
        if (current.earning <= this.jump1TestByEarning) {
            this.jumpTestStack++;
            this.jumpedTest.jump1TestByEarning++;
            return true;
        }

        return false;
    }

    checkJumpTestByTrade(current) {
        if (current.trades <= this.jumpTestByTrade) {
            this.jumpTestStack++;
            this.jumpedTest.jumpTestByTrade++;
            return true;
        }

        return false;
    }

    checkJumpTestByWinrate(current) {
        if (current.winrate <= this.jumpTestByWinrate) {
            this.jumpTestStack++;
            this.jumpedTest.jumpTestByWinrate++;
            return true;
        }

        return false;
    }

    checkJumpTestByEarningMinus(current, previous) {
        // don't compare with previous if it's on first cursor
        if (this.parameters[this.jumpParamIndex].getCurrent() === this.parameters[this.jumpParamIndex].min) {
            return false;
        }

        if (current.earning <= this.jumpTestByEarningMinus && current.earning < previous.earning) {
            this.jumpTestStack++;
            this.jumpedTest.jumpTestByEarningMinus++;
            return true;
        }

        return false;
    }

    // UI

    interfaceDecorator(state) {
        switch (state) {
            case 'available':
                this.strategy.style.border = '3px dashed #00FF00';
                break;
            case 'lock':
                this.strategy.style.border = '3px dashed #ed2939';
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
            label.style.top = '45px';
            label.style.left = '0';
            label.style.backgroundColor = '#00FF00';
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
            const estimateTimeByTest = (new Date().getTime() - this.dateStart) / (this.backtestNumber - this.jumpTestAfterStart);
            remainingTime = new Date(new Date().getTime() + (estimateTimeByTest * (this.backtestTotal - this.backtestNumber))).toLocaleString();
        }

        content += ` (${this.backtestNumber}/${this.backtestTotal}) ending at: ${remainingTime}`;
        this.setLabel(content);
    }

    // MANAGE STATS

    collectInfos() {
        const indics = [];
        document.querySelectorAll('.indicator-title .name:not(.selected)').forEach(indic => indics.push(indic.innerText));

        return {
            timeframe: document.querySelector('.contests .choice2.selected').innerText.trim(),
            currency: document.querySelector('.contests .choice3.selected').innerText.trim(),
            earningCurrency: document.querySelector('.category-rm .vue-js-switch.toggled') ? 'BTC' : 'HXRO',
            currentIndicator: this.indicators.querySelector('.indicator-title .name.selected').innerText.trim(),
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
            evalEstimateDuringTime = `${msToTime(remainingTime)} (total: ${msToTime(totalTime)})`;
            evalEstimateEndingTime = `${new Date(new Date().getTime() + remainingTime).toLocaleString()}`;
        } else {
            evalIndicator = `${this.infos.currentIndicator} (${this.parameters.length} parameters with ${countCursor} cursors)`;
            evalCountTest = `${this.backtestTotal}`;
            evalEstimateDuringTime = `${msToTime(totalTime)}`;
            evalEstimateEndingTime = `${new Date(new Date().getTime() + totalTime).toLocaleString()}`;
        }

        this.setLabel(`ready to start : ${evalEstimateEndingTime}`);

        console.group('--BACKTEST EVALUATION--');
        console.log('indicator: ' + evalIndicator);
        console.log('number of tests: ' + evalCountTest);
        console.log('estimate time to full backtest indicator: ' + evalEstimateDuringTime);
        console.log('estimate ending time: ' + evalEstimateEndingTime);
        console.groupCollapsed('options');
        console.table({
            debug: this.debug,
            jumpTestAfterStart: this.jumpTestAfterStart,
            jumpTestsParamByTrade: this.jumpTestsParamByTrade,
            jumpTestsParamByEarning: this.jumpTestsParamByEarning,
            jump3TestByEarning: this.jump3TestByEarning,
            jump2TestByEarning: this.jump2TestByEarning,
            jump1TestByEarning: this.jump1TestByEarning,
            jumpTestByTrade: this.jumpTestByTrade,
            jumpTestByWinrate: this.jumpTestByWinrate,
            jumpTestByEarningMinus: this.jumpTestByEarningMinus,
        });
        console.groupEnd();
        console.groupEnd();
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
        perfData['earning'] = parseFloat(this.strategy.querySelector('.perf-stats .backtest-perf').childNodes[0].nodeValue.trim().replace(/[^\d.-]/g, ''));
        perfData['winrate'] = parseFloat(perfPanel[0].querySelector('.number').innerText.replace(/[^\d.-]/g, ''));
        perfData['payout'] = parseFloat(perfPanel[3].querySelector('.number').innerText.replace(/[^\d.-]/g, ''));
        perfData['drawdown'] = parseFloat(perfPanel[4].querySelector('.number').innerText);
        perfData['ratio'] = parseFloat(0 < perfData['earning'] ? perfData['earning'] / (Math.abs(perfData['drawdown']) !== 0 ? Math.abs(perfData['drawdown']): 1) : 0).toFixed(2);
        perfData['trades'] = parseInt(perfPanel[6].querySelector('.number').innerText);
        perfData['winstreak'] = parseInt(perfPanel[2].querySelector('.number').innerText);
        perfData['losestreak'] = parseInt(perfPanel[5].querySelector('.number').innerText);
        perfData['pool'] = parseInt(perfPanel[1].querySelector('.number').innerText);
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

    debug() {
        console.log(`--INDICATOR: ${this.infos.currentIndicator}`);
        console.log(`countParameters: ${this.parameters.length}`);

        this.parameters.forEach(parameter => {
            parameter.debug();
        });
    }
}
