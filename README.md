# hxrobot-script

copy/paste `dist/hxrobot-script.js` into Chrome dev console

and choose a strategy panel, several way to do this :

```javascript
// preferred: provide the number (0-9)
let strat1 = new Strategy(0);

// provide element
let strat1 = new Strategy(document.querySelector('.strategy'));

// provide added ID name
let strat1 = new Strategy('my-id-strategy');
```

## init

```javascript
strat1.init();
```

If the backtest evaluation is not satisfactory, you can change parameter, indicator, init options and call again init() method.

### global options

| name | type | default | priority | description |
|------|------|---------|----------|-------------|
| `jumpTestAfterStart` | integer | `0` | cumulative | (1*) start backtests after a specific number of tests (useful if script has been stop and restart it) |
| `jumpTestsParamByTrade` | boolean / integer | `false` | 0 | (2*) if a test <= "x" trade, it **jump all following** cursor tests in the last parameter. (ex: set to 0 useful for Orderflow) |
| `jumpTestsParamByEarning` | boolean / integer | `false` | 1 | (2*) if a test <= "x" earning, it **jump all following** cursor tests in the last parameter. (ex: set to -1000 useful for bad series) |
| `jumpTestByEarning` | boolean / integer | `false` | 2 | (2*) if a test <= "x" earning, it **jump one** next cursor test in the last parameter |
| `jumpTestByTrade` | boolean / integer | `false` | 3 | (2*) if a test <= "x" trade, it **jump one** next cursor test in the last parameter |
| `jumpTestByEarningMinus` | boolean / integer | `false` | 4 | (2*) if a test <= "x" earning and if it's smaller that the previous one, it **jump one** next cursor test in the last parameter |
| `debug` | boolean | `false` | cumulative | only to help debugging |

(1*) : issue, maybe freeze interface several minute with huge value (+3000), and possibility that backtest process don't work.

(2*) : only work if the last non-ignored parameter is a slider or optionalSlider type. And non cumulative with other (2*).

```javascript
strat1.init({
    jumpTestAfterStart: 2135,
    jumpTestsParamByTrade: 0,
    jumpTestsParamByEarning: -1000,
    jumpTestByEarning: -50,
    jumpTestByTrade: 25,
    jumpTestByEarningMinus: -200,
    debug: true,
});
```

### parameter options

You can affine what values to test by parameter. First UI parameter is 0.

| name | type/value | default | description |
|------|------|---------|-------------|
| `increment` | `'auto'` / float / `false` | `'auto'` | (1*) default value (`'auto'`) keep only 10 cursor for the parameter. Set `false` to keep all cursor, or set a custom value number to increment (ex: `2`, `0.8`, etc.) |
| `min` | `'auto'` / float / `false` | `'auto'` | (1*) default value (`'auto'`) remove the first cursor of the parameter. Set `false` to keep the extreme minimum value, or set a custom value for min (ex: `2`, `0.8`, etc.) |
| `max` | `'auto'` / float / `false` | `'auto'` | (1*) Same as min, but for the max value |
| `ignore` | boolean | `false` | ignore this parameter, backtest never touch this one |

(1*) : "Streak" indicator issue, the value showed in input is not the real value, inspect element (chrome console) or keep these raw values in mind: min = -27, max: 27, increment: 1

```javascript
strat1.init({
    0: {ignore: true},
    1: {min: 4, max: 6},
    2: {increment: 2},
    3: {min: false, max: false, increment: false}, // disable `'auto'` mode
});
```

## Start backtest

PC must not be on standby, and the chrome tab must be active during all time for the backtest. Just wait finish backtest, that automatically provide a download CSV.

```javascript
strat1.start();
```

## Stop backtest

If for one reason you need to stop the backtest process, just use the following command.

```javascript
strat1.stop();
```

## Supported indicators

| indicator | nb parameters | nb cursors | nb tests | total testing time | init() testing time |
|-----------|---------------|------------|----------|--------------------|---------------------|
| Random | 3 | 1202 | 10201000 | 1889 Days | 4.4 Hrs |
| Payout | 5 | 141 | 85600 | 16 Days | 12.8 Hrs |
| SAR | 7 | 338 | 705672000 | 139155 Days | 29.6 Days |
| Orderflow | 8 | 1044 | 6943132800 | 1285765 Days | 53.3 Days |
| Delta div | 7 | 150 | 3341760 | 619 Days | 5.3 Days |
| Streak | 6 | 92 | 89600 | 16 Days | 1.3 Days |
| Stoch | 6 | 70 | 96000 | 16 Days | 1.9 Days |
| Bollinger | 5 | 90 | 36000 | 7 Days | 7.1 Hrs |
| MACD | 5 | 100 | 43200 | 8 Days | 7.1 Hrs |
| RSI | 6 | 1041 | 288708000 | 53573 Days | 3 Days |
| Orderbook | 7 | 539 | 4844102400 | 86567456 Days | 72.6 Days |
| Autocorr | 10 | 1088 | 48192192000 | 8924480 Days | 213.3 Days |

## Supported options

|           | slider | switch | optional slider | select |
|:---------:|:--------------:|:------:|:---------------:|:------:|
| ignore    |:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|
| increment |:heavy_check_mark:|:x:|:heavy_check_mark:|:x:|
| min       |:heavy_check_mark:|:x:|:heavy_check_mark:|:x:|
| max       |:heavy_check_mark:|:x:|:heavy_check_mark:|:x:|

## Already tested

|               | Random | Payout | SAR | Orderflow | Delta | Streak | Stoch | Bollinger | MACD | RSI | Orderbook | Autocorr |
|---------------|:------:|:------:|:---:|:---------:|:-----:|:------:|:-----:|:---------:|:----:|:---:|:---------:|:--------:|
| **eth 15min** |        |    x   |     |     x     |   x   |        |   x   |     x     |  x   |  x  |     x     |          |

## Other

```javascript
// Test indicator with fully backtests
strat1.init({
    0: {min:false, max:false, increment:false},
    1: {min:false, max:false, increment:false},
    2: {min:false, max:false, increment:false},
    3: {min:false, max:false, increment:false},
    4: {min:false, max:false, increment:false},
    5: {min:false, max:false, increment:false},
    6: {min:false, max:false, increment:false},
    7: {min:false, max:false, increment:false},
    8: {min:false, max:false, increment:false},
    9: {min:false, max:false, increment:false},
});
```
