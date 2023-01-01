:warning::warning::warning:

This script was a helper to automate strategies on the old platforme [hxrobot.io](hxrobot.io). You could perform thousands of tests on multiple strategies and save results statistics on the exported CSV. But time passed, HXRO had bought hxrobot and migrated to a new "Automated Trading" platform which no longer exists today, and finally FTX fell and impacted the entire Solana ecosystem (including HXRO). Feel free to explore code. That was fun and tricky to develop it. The goal was to use an automated script as quickly as possible. So a script to execute in console browser isn't the smartest and robust solution (maybe it's better to create an extension browser). But my solution was the fastest from a "time to market" point of view.

:warning::warning::warning:

# hxrobot-script

Copy/paste `dist/hxrobot-script.js` into a bookmark, prefix content with `javascript:` and load it on a strategy page. For the old way, you can copy/paste script into Firefox dev console (Chromium engine cut the websocket if tab isn't all the time active).

And choose a strategy panel :

```javascript
// provide the number (0-9)
let strat1 = new Strategy(0);
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
| `jumpParamNumber` | boolean/integer | `false` | cumulative | by default this is the last active parameter who have jump processed, provide a number to choose another parameter |
| `jumpAutoSeries` | boolean | `false` | cumulative | load `jumpTestsParamByTrade` & `jumpTestsParamByEarning` with auto values optimized for current timeframe |
| `jumpTestsParamByTrade` | boolean / integer | `false` or `int` provided by `jumpAutoSeries` | 0 | (2*) if a test <= "x" trade, it **jump all following** cursor tests in the last parameter. (ex: set to 0 useful for Orderflow) |
| `jumpTestsParamByEarning` | boolean / integer | `false` or `int` provided by `jumpAutoSeries` | 1 | (2*) if a test <= "x" earning, it **jump all following** cursor tests in the last parameter. (ex: set to -1000 useful for bad series) |
| `jumpAuto` | boolean | `true` | cumulative | load `jump3TestByEarning`, `jump2TestByEarning`, `jump1TestByEarning`, `jumpTestByTrade` & `jumpTestByWinrate` with auto values optimized for current timeframe |
| `jump3TestByEarning` | boolean / integer | `false` or `int` provided by `jumpAuto` | 2 | (2*) if a test <= "x" earning, it **jump 3** next cursor tests in the last parameter |
| `jump2TestByEarning` | boolean / integer | `false` or `int` provided by `jumpAuto` | 3 | (2*) if a test <= "x" earning, it **jump 2** next cursor tests in the last parameter |
| `jump1TestByEarning` | boolean / integer | `false` or `int` provided by `jumpAuto` | 4 | (2*) if a test <= "x" earning, it **jump one** next cursor test in the last parameter |
| `jumpTestByTrade` | boolean / integer | `false` or `int` provided by `jumpAuto` | 5 | (2*) if a test <= "x" trade, it **jump one** next cursor test in the last parameter |
| `jumpTestByWinrate` | boolean / float | `false` or `float` provided by `jumpAuto` | 6 | (2*) if a test <= "x" winrate, it **jump one** next cursor test in the last parameter |
| `jumpTestByEarningMinus` | boolean / integer | `false` | 7 | (2*) if a test <= "x" earning and if it's smaller that the previous one, it **jump one** next cursor test in the last parameter |
| `debug` | boolean | `false` | cumulative | only to help debugging |

(1*) : issue, maybe freeze interface several minute with huge value (+3000), and possibility that backtest process don't work.

(2*) : only work if the last non-ignored parameter is a slider or optionalSlider type. And non cumulative with other (2*).

```javascript
// Example with full global options
strat1.init({
    jumpTestAfterStart: 2135,
    jumpParamNumber: 4,
    jumpAutoSeries: true, // override specific value you need
    jumpTestsParamByTrade: 0, // override value from jumpAutoSeries
    jumpTestsParamByEarning: -1000, // override value from jumpAutoSeries
    // jumpAuto: true, // true by default, no need to fill it, override specific value you need
    jump3TestByEarning: -500, // override value from jumpAuto
    jump2TestByEarning: -200, // override value from jumpAuto
    jump1TestByEarning: -50, // override value from jumpAuto
    jumpTestByTrade: 25, // override value from jumpAuto
    jumpTestByWinrate: 50, // override value from jumpAuto
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

PC must not be on standby. Just wait finish backtest, that automatically provide a download CSV.

```javascript
strat1.start();
```

## Stop backtest

If for one reason you need to stop the backtest process, just use the following command.

```javascript
strat1.stop();
```

## Exception - Streak

The slider parameter **Trade condition** of **Streak** parameter has different value between hxrobot display and the real data that script can get. The following table show the correspondence.

| hxrobot | script | | hxrobot | script | | hxrobot | script | | hxrobot | script | | hxrobot | script | | hxrobot | script | | hxrobot | script |
|---:|:---|---|---:|:---|---|---:|:---|---|---:|:---|---|---:|:---|---|---:|:---|---|---:|:---|
| 0.001 | -27 | | 0.01 | -18 | | 0.1 | -9 | | 1 | 0 | | 10 | 9  | | 100 | 18 | | 1000 | 27 |
| 0.002 | -26 | | 0.02 | -17 | | 0.2 | -8 | | 2 | 1 | | 20 | 10 | | 200 | 19 | |      |    |
| 0.003 | -25 | | 0.03 | -16 | | 0.3 | -7 | | 3 | 2 | | 30 | 11 | | 300 | 20 | |      |    |
| 0.004 | -24 | | 0.04 | -15 | | 0.4 | -6 | | 4 | 3 | | 40 | 12 | | 400 | 21 | |      |    |
| 0.005 | -23 | | 0.05 | -14 | | 0.5 | -5 | | 5 | 4 | | 50 | 13 | | 500 | 22 | |      |    |
| 0.006 | -22 | | 0.06 | -13 | | 0.6 | -4 | | 6 | 5 | | 60 | 14 | | 600 | 23 | |      |    |
| 0.007 | -21 | | 0.07 | -12 | | 0.7 | -3 | | 7 | 6 | | 70 | 15 | | 700 | 24 | |      |    |
| 0.008 | -20 | | 0.08 | -11 | | 0.8 | -2 | | 8 | 7 | | 80 | 16 | | 800 | 25 | |      |    |
| 0.009 | -19 | | 0.09 | -10 | | 0.9 | -1 | | 9 | 8 | | 90 | 17 | | 900 | 26 | |      |    |

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
