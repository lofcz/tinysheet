# Excel function coverage

Every function in Microsoft's "Excel functions (by category)" list and its
status in TinySheet. The table is checked by
`test/unit/functions/coverage.js`: every Supported or Partial function must be
known to the engine (`SUPPORTED_FORMULAS`) or implemented by core.

- **Supported**: implemented with Excel's semantics; examples from
  Microsoft's documentation are in the parity corpus
  (`test/integration/parsing/batch2/corpus-data.mjs`).
- **Partial**: implemented with the limitation noted.
- **Missing**: not implemented, with the reason.
- **Excluded**: out of scope (Cube and web-service functions).

Totals: 473 supported, 32 partial,
6 missing, 13 excluded (524 functions).

## Eta-reduced functions (GROUPBY, PIVOTBY, MAP, ...)

`GROUPBY(A2:A9, B2:B9, SUM)` passes the bare name `SUM` as a value. The
evaluator still looks bare names up as variables, which is `#NAME?`.
Until it produces eta LAMBDAs, write the name as text
(`GROUPBY(A2:A9, B2:B9, "SUM")`) or as a LAMBDA (`LAMBDA(x, SUM(x))`).

The evaluator change needed (tried locally with the formulas below) is in
`Evaluator#evaluateName` (`src/grammar-parser/evaluator.js`), using
`etaLambda` from `src/functions/eta.js`:

```js
let value;

try {
  value = this.yy.callVariable(node.name);
} catch (ex) {
  if (BUILTIN_FUNCTIONS.has(node.key) || this.hasCustomFunction(node.name)) {
    return etaLambda(node.key, (args) =>
      this.yy.callFunction(node.name, args, [])
    );
  }
  throw ex;
}

return this.hostReference(value, true) || value;
```

With it, `GROUPBY(..., SUM)`, `HSTACK(SUM, AVERAGE)`, `PERCENTOF`,
`BYROW(A1:C3, SUM)` and `MAP(A1:A3, ABS)` work, and a bare function name as a
cell result is `#CALC!` like any other LAMBDA.

### Compatibility

| Function     | Status    | Notes |
| ------------ | --------- | ----- |
| BETADIST     | Supported |       |
| BETAINV      | Supported |       |
| BINOMDIST    | Supported |       |
| CEILING      | Supported |       |
| CHIDIST      | Supported |       |
| CHIINV       | Supported |       |
| CHITEST      | Supported |       |
| CONCATENATE  | Supported |       |
| CONFIDENCE   | Supported |       |
| COVAR        | Supported |       |
| CRITBINOM    | Supported |       |
| EXPONDIST    | Supported |       |
| FDIST        | Supported |       |
| FINV         | Supported |       |
| FLOOR        | Supported |       |
| FORECAST     | Supported |       |
| FTEST        | Supported |       |
| GAMMADIST    | Supported |       |
| GAMMAINV     | Supported |       |
| HYPGEOMDIST  | Supported |       |
| LOGINV       | Supported |       |
| LOGNORMDIST  | Supported |       |
| MODE         | Supported |       |
| NEGBINOMDIST | Supported |       |
| NORMDIST     | Supported |       |
| NORMINV      | Supported |       |
| NORMSDIST    | Supported |       |
| NORMSINV     | Supported |       |
| PERCENTILE   | Supported |       |
| PERCENTRANK  | Supported |       |
| POISSON      | Supported |       |
| QUARTILE     | Supported |       |
| RANK         | Supported |       |
| STDEV        | Supported |       |
| STDEVP       | Supported |       |
| TDIST        | Supported |       |
| TINV         | Supported |       |
| TTEST        | Supported |       |
| VAR          | Supported |       |
| VARP         | Supported |       |
| WEIBULL      | Supported |       |
| ZTEST        | Supported |       |

### Cube

| Function           | Status   | Notes                                                  |
| ------------------ | -------- | ------------------------------------------------------ |
| CUBEKPIMEMBER      | Excluded | Cube functions need an OLAP connection (out of scope). |
| CUBEMEMBER         | Excluded | Cube functions need an OLAP connection (out of scope). |
| CUBEMEMBERPROPERTY | Excluded | Cube functions need an OLAP connection (out of scope). |
| CUBERANKEDMEMBER   | Excluded | Cube functions need an OLAP connection (out of scope). |
| CUBESET            | Excluded | Cube functions need an OLAP connection (out of scope). |
| CUBESETCOUNT       | Excluded | Cube functions need an OLAP connection (out of scope). |
| CUBEVALUE          | Excluded | Cube functions need an OLAP connection (out of scope). |

### Database

| Function | Status  | Notes                                                                                         |
| -------- | ------- | --------------------------------------------------------------------------------------------- |
| DAVERAGE | Partial | Computed criteria are applied as constants.                                                   |
| DCOUNT   | Partial | Computed criteria are applied as constants (formula results are not re-evaluated per record). |
| DCOUNTA  | Partial | Computed criteria are applied as constants.                                                   |
| DGET     | Partial | Computed criteria are applied as constants.                                                   |
| DMAX     | Partial | Computed criteria are applied as constants.                                                   |
| DMIN     | Partial | Computed criteria are applied as constants.                                                   |
| DPRODUCT | Partial | Computed criteria are applied as constants.                                                   |
| DSTDEV   | Partial | Computed criteria are applied as constants.                                                   |
| DSTDEVP  | Partial | Computed criteria are applied as constants.                                                   |
| DSUM     | Partial | Computed criteria are applied as constants.                                                   |
| DVAR     | Partial | Computed criteria are applied as constants.                                                   |
| DVARP    | Partial | Computed criteria are applied as constants.                                                   |

### Date and time

| Function         | Status    | Notes |
| ---------------- | --------- | ----- |
| DATE             | Supported |       |
| DATEDIF          | Supported |       |
| DATEVALUE        | Supported |       |
| DAY              | Supported |       |
| DAYS             | Supported |       |
| DAYS360          | Supported |       |
| EDATE            | Supported |       |
| EOMONTH          | Supported |       |
| HOUR             | Supported |       |
| ISOWEEKNUM       | Supported |       |
| MINUTE           | Supported |       |
| MONTH            | Supported |       |
| NETWORKDAYS      | Supported |       |
| NETWORKDAYS.INTL | Supported |       |
| NOW              | Supported |       |
| SECOND           | Supported |       |
| TIME             | Supported |       |
| TIMEVALUE        | Supported |       |
| TODAY            | Supported |       |
| WEEKDAY          | Supported |       |
| WEEKNUM          | Supported |       |
| WORKDAY          | Supported |       |
| WORKDAY.INTL     | Supported |       |
| YEAR             | Supported |       |
| YEARFRAC         | Supported |       |

### Engineering

| Function     | Status    | Notes |
| ------------ | --------- | ----- |
| BESSELI      | Supported |       |
| BESSELJ      | Supported |       |
| BESSELK      | Supported |       |
| BESSELY      | Supported |       |
| BIN2DEC      | Supported |       |
| BIN2HEX      | Supported |       |
| BIN2OCT      | Supported |       |
| BITAND       | Supported |       |
| BITLSHIFT    | Supported |       |
| BITOR        | Supported |       |
| BITRSHIFT    | Supported |       |
| BITXOR       | Supported |       |
| COMPLEX      | Supported |       |
| CONVERT      | Supported |       |
| DEC2BIN      | Supported |       |
| DEC2HEX      | Supported |       |
| DEC2OCT      | Supported |       |
| DELTA        | Supported |       |
| ERF          | Supported |       |
| ERF.PRECISE  | Supported |       |
| ERFC         | Supported |       |
| ERFC.PRECISE | Supported |       |
| GESTEP       | Supported |       |
| HEX2BIN      | Supported |       |
| HEX2DEC      | Supported |       |
| HEX2OCT      | Supported |       |
| IMABS        | Supported |       |
| IMAGINARY    | Supported |       |
| IMARGUMENT   | Supported |       |
| IMCONJUGATE  | Supported |       |
| IMCOS        | Supported |       |
| IMCOSH       | Supported |       |
| IMCOT        | Supported |       |
| IMCSC        | Supported |       |
| IMCSCH       | Supported |       |
| IMDIV        | Supported |       |
| IMEXP        | Supported |       |
| IMLN         | Supported |       |
| IMLOG10      | Supported |       |
| IMLOG2       | Supported |       |
| IMPOWER      | Supported |       |
| IMPRODUCT    | Supported |       |
| IMREAL       | Supported |       |
| IMSEC        | Supported |       |
| IMSECH       | Supported |       |
| IMSIN        | Supported |       |
| IMSINH       | Supported |       |
| IMSQRT       | Supported |       |
| IMSUB        | Supported |       |
| IMSUM        | Supported |       |
| IMTAN        | Supported |       |
| OCT2BIN      | Supported |       |
| OCT2DEC      | Supported |       |
| OCT2HEX      | Supported |       |

### Financial

| Function     | Status    | Notes                                  |
| ------------ | --------- | -------------------------------------- |
| ACCRINT      | Supported |                                        |
| ACCRINTM     | Supported |                                        |
| AMORDEGRC    | Supported |                                        |
| AMORLINC     | Supported |                                        |
| COUPDAYBS    | Supported |                                        |
| COUPDAYS     | Supported |                                        |
| COUPDAYSNC   | Supported |                                        |
| COUPNCD      | Supported |                                        |
| COUPNUM      | Supported |                                        |
| COUPPCD      | Supported |                                        |
| CUMIPMT      | Supported |                                        |
| CUMPRINC     | Supported |                                        |
| DB           | Supported |                                        |
| DDB          | Supported |                                        |
| DISC         | Supported |                                        |
| DOLLARDE     | Supported |                                        |
| DOLLARFR     | Supported |                                        |
| DURATION     | Supported |                                        |
| EFFECT       | Supported |                                        |
| FV           | Supported |                                        |
| FVSCHEDULE   | Supported |                                        |
| INTRATE      | Supported |                                        |
| IPMT         | Supported |                                        |
| IRR          | Supported |                                        |
| ISPMT        | Supported |                                        |
| MDURATION    | Supported |                                        |
| MIRR         | Supported |                                        |
| NOMINAL      | Supported |                                        |
| NPER         | Supported |                                        |
| NPV          | Supported |                                        |
| ODDFPRICE    | Supported |                                        |
| ODDFYIELD    | Supported |                                        |
| ODDLPRICE    | Supported |                                        |
| ODDLYIELD    | Supported |                                        |
| PDURATION    | Supported |                                        |
| PMT          | Supported |                                        |
| PPMT         | Supported |                                        |
| PRICE        | Supported |                                        |
| PRICEDISC    | Supported |                                        |
| PRICEMAT     | Supported |                                        |
| PV           | Supported |                                        |
| RATE         | Supported |                                        |
| RECEIVED     | Supported |                                        |
| RRI          | Supported |                                        |
| SLN          | Supported |                                        |
| STOCKHISTORY | Excluded  | Needs Microsoft's online data service. |
| SYD          | Supported |                                        |
| TBILLEQ      | Supported |                                        |
| TBILLPRICE   | Supported |                                        |
| TBILLYIELD   | Supported |                                        |
| VDB          | Supported |                                        |
| XIRR         | Supported |                                        |
| XNPV         | Supported |                                        |
| YIELD        | Supported |                                        |
| YIELDDISC    | Supported |                                        |
| YIELDMAT     | Supported |                                        |

### Information

| Function   | Status    | Notes                                                           |
| ---------- | --------- | --------------------------------------------------------------- |
| CELL       | Supported | Implemented by core (`formulaFunctions.ts`).                    |
| ERROR.TYPE | Supported |                                                                 |
| INFO       | Partial   | Fixed answers for a web host; memory-related types are #VALUE!. |
| ISBLANK    | Supported |                                                                 |
| ISERR      | Supported |                                                                 |
| ISERROR    | Supported |                                                                 |
| ISEVEN     | Supported |                                                                 |
| ISFORMULA  | Supported | Implemented by core (`formulaFunctions.ts`).                    |
| ISLOGICAL  | Supported |                                                                 |
| ISNA       | Supported |                                                                 |
| ISNONTEXT  | Supported |                                                                 |
| ISNUMBER   | Supported |                                                                 |
| ISODD      | Supported |                                                                 |
| ISOMITTED  | Supported |                                                                 |
| ISREF      | Supported | Implemented by core (`formulaFunctions.ts`).                    |
| ISTEXT     | Supported |                                                                 |
| N          | Supported |                                                                 |
| NA         | Supported |                                                                 |
| SHEET      | Supported | Implemented by core (`formulaFunctions.ts`).                    |
| SHEETS     | Supported | Implemented by core (`formulaFunctions.ts`).                    |
| TYPE       | Supported |                                                                 |

### Logical

| Function  | Status    | Notes |
| --------- | --------- | ----- |
| AND       | Supported |       |
| BYCOL     | Supported |       |
| BYROW     | Supported |       |
| FALSE     | Supported |       |
| IF        | Supported |       |
| IFERROR   | Supported |       |
| IFNA      | Supported |       |
| IFS       | Supported |       |
| LAMBDA    | Supported |       |
| LET       | Supported |       |
| MAKEARRAY | Supported |       |
| MAP       | Supported |       |
| NOT       | Supported |       |
| OR        | Supported |       |
| REDUCE    | Supported |       |
| SCAN      | Supported |       |
| SWITCH    | Supported |       |
| TRUE      | Supported |       |
| XOR       | Supported |       |

### Lookup and reference

| Function     | Status    | Notes                                                                                            |
| ------------ | --------- | ------------------------------------------------------------------------------------------------ |
| ADDRESS      | Supported | Implemented by core (`formulaFunctions.ts`).                                                     |
| AREAS        | Partial   | Returns 1 for a single reference; multi-area unions are not counted.                             |
| CHOOSE       | Supported |                                                                                                  |
| CHOOSECOLS   | Supported |                                                                                                  |
| CHOOSEROWS   | Supported |                                                                                                  |
| COLUMN       | Supported |                                                                                                  |
| COLUMNS      | Supported |                                                                                                  |
| DROP         | Supported |                                                                                                  |
| EXPAND       | Supported |                                                                                                  |
| FILTER       | Supported |                                                                                                  |
| FORMULATEXT  | Supported | Implemented by core (`formulaFunctions.ts`).                                                     |
| GETPIVOTDATA | Missing   | No PivotTable objects.                                                                           |
| GROUPBY      | Partial   | Bare eta-reduced names (`SUM`) need evaluator support; LAMBDAs and names as text (`"SUM"`) work. |
| HLOOKUP      | Supported |                                                                                                  |
| HSTACK       | Supported |                                                                                                  |
| HYPERLINK    | Supported | Implemented by core (`formulaFunctions.ts`).                                                     |
| IMAGE        | Partial   | No in-cell pictures yet: returns the alt text (or the source).                                   |
| INDEX        | Supported |                                                                                                  |
| INDIRECT     | Supported | Implemented by core (`formulaFunctions.ts`).                                                     |
| LOOKUP       | Supported |                                                                                                  |
| MATCH        | Supported |                                                                                                  |
| OFFSET       | Supported | Implemented by core (`formulaFunctions.ts`).                                                     |
| PIVOTBY      | Partial   | As GROUPBY; header layout with `field_headers` 3 is a best effort.                               |
| ROW          | Supported |                                                                                                  |
| ROWS         | Supported |                                                                                                  |
| RTD          | Missing   | Needs a COM automation server.                                                                   |
| SORT         | Supported |                                                                                                  |
| SORTBY       | Supported |                                                                                                  |
| TAKE         | Supported |                                                                                                  |
| TOCOL        | Supported |                                                                                                  |
| TOROW        | Supported |                                                                                                  |
| TRANSPOSE    | Supported |                                                                                                  |
| TRIMRANGE    | Supported |                                                                                                  |
| UNIQUE       | Supported |                                                                                                  |
| VLOOKUP      | Supported |                                                                                                  |
| VSTACK       | Supported |                                                                                                  |
| WRAPCOLS     | Supported |                                                                                                  |
| WRAPROWS     | Supported |                                                                                                  |
| XLOOKUP      | Supported |                                                                                                  |
| XMATCH       | Supported |                                                                                                  |

### Math and trigonometry

| Function        | Status    | Notes |
| --------------- | --------- | ----- |
| ABS             | Supported |       |
| ACOS            | Supported |       |
| ACOSH           | Supported |       |
| ACOT            | Supported |       |
| ACOTH           | Supported |       |
| AGGREGATE       | Supported |       |
| ARABIC          | Supported |       |
| ASIN            | Supported |       |
| ASINH           | Supported |       |
| ATAN            | Supported |       |
| ATAN2           | Supported |       |
| ATANH           | Supported |       |
| BASE            | Supported |       |
| CEILING.MATH    | Supported |       |
| CEILING.PRECISE | Supported |       |
| COMBIN          | Supported |       |
| COMBINA         | Supported |       |
| COS             | Supported |       |
| COSH            | Supported |       |
| COT             | Supported |       |
| COTH            | Supported |       |
| CSC             | Supported |       |
| CSCH            | Supported |       |
| DECIMAL         | Supported |       |
| DEGREES         | Supported |       |
| EVEN            | Supported |       |
| EXP             | Supported |       |
| FACT            | Supported |       |
| FACTDOUBLE      | Supported |       |
| FLOOR.MATH      | Supported |       |
| FLOOR.PRECISE   | Supported |       |
| GCD             | Supported |       |
| INT             | Supported |       |
| ISO.CEILING     | Supported |       |
| LCM             | Supported |       |
| LN              | Supported |       |
| LOG             | Supported |       |
| LOG10           | Supported |       |
| MDETERM         | Supported |       |
| MINVERSE        | Supported |       |
| MMULT           | Supported |       |
| MOD             | Supported |       |
| MROUND          | Supported |       |
| MULTINOMIAL     | Supported |       |
| MUNIT           | Supported |       |
| ODD             | Supported |       |
| PERCENTOF       | Supported |       |
| PI              | Supported |       |
| POWER           | Supported |       |
| PRODUCT         | Supported |       |
| QUOTIENT        | Supported |       |
| RADIANS         | Supported |       |
| RAND            | Supported |       |
| RANDARRAY       | Supported |       |
| RANDBETWEEN     | Supported |       |
| ROMAN           | Supported |       |
| ROUND           | Supported |       |
| ROUNDDOWN       | Supported |       |
| ROUNDUP         | Supported |       |
| SEC             | Supported |       |
| SECH            | Supported |       |
| SEQUENCE        | Supported |       |
| SERIESSUM       | Supported |       |
| SIGN            | Supported |       |
| SIN             | Supported |       |
| SINH            | Supported |       |
| SQRT            | Supported |       |
| SQRTPI          | Supported |       |
| SUBTOTAL        | Supported |       |
| SUM             | Supported |       |
| SUMIF           | Supported |       |
| SUMIFS          | Supported |       |
| SUMPRODUCT      | Supported |       |
| SUMSQ           | Supported |       |
| SUMX2MY2        | Supported |       |
| SUMX2PY2        | Supported |       |
| SUMXMY2         | Supported |       |
| TAN             | Supported |       |
| TANH            | Supported |       |
| TRUNC           | Supported |       |

### Statistical

| Function                 | Status    | Notes                                                                                               |
| ------------------------ | --------- | --------------------------------------------------------------------------------------------------- |
| AVEDEV                   | Supported |                                                                                                     |
| AVERAGE                  | Supported |                                                                                                     |
| AVERAGEA                 | Supported |                                                                                                     |
| AVERAGEIF                | Supported |                                                                                                     |
| AVERAGEIFS               | Supported |                                                                                                     |
| BETA.DIST                | Supported |                                                                                                     |
| BETA.INV                 | Supported |                                                                                                     |
| BINOM.DIST               | Supported |                                                                                                     |
| BINOM.DIST.RANGE         | Supported |                                                                                                     |
| BINOM.INV                | Supported |                                                                                                     |
| CHISQ.DIST               | Supported |                                                                                                     |
| CHISQ.DIST.RT            | Supported |                                                                                                     |
| CHISQ.INV                | Supported |                                                                                                     |
| CHISQ.INV.RT             | Supported |                                                                                                     |
| CHISQ.TEST               | Supported |                                                                                                     |
| CONFIDENCE.NORM          | Supported |                                                                                                     |
| CONFIDENCE.T             | Supported |                                                                                                     |
| CORREL                   | Supported |                                                                                                     |
| COUNT                    | Supported |                                                                                                     |
| COUNTA                   | Supported |                                                                                                     |
| COUNTBLANK               | Supported |                                                                                                     |
| COUNTIF                  | Supported |                                                                                                     |
| COUNTIFS                 | Supported |                                                                                                     |
| COVARIANCE.P             | Supported |                                                                                                     |
| COVARIANCE.S             | Supported |                                                                                                     |
| DEVSQ                    | Supported |                                                                                                     |
| EXPON.DIST               | Supported |                                                                                                     |
| F.DIST                   | Supported |                                                                                                     |
| F.DIST.RT                | Supported |                                                                                                     |
| F.INV                    | Supported |                                                                                                     |
| F.INV.RT                 | Supported |                                                                                                     |
| F.TEST                   | Supported |                                                                                                     |
| FISHER                   | Supported |                                                                                                     |
| FISHERINV                | Supported |                                                                                                     |
| FORECAST.ETS             | Partial   | Additive Holt-Winters with grid-searched smoothing; exact on exact trends/seasons, close otherwise. |
| FORECAST.ETS.CONFINT     | Partial   | Interval from the fitted model's one-step error; approximate.                                       |
| FORECAST.ETS.SEASONALITY | Partial   | Autocorrelation-based detection; approximate.                                                       |
| FORECAST.ETS.STAT        | Partial   | Statistics of the approximate model.                                                                |
| FORECAST.LINEAR          | Supported |                                                                                                     |
| FREQUENCY                | Supported |                                                                                                     |
| GAMMA                    | Supported |                                                                                                     |
| GAMMA.DIST               | Supported |                                                                                                     |
| GAMMA.INV                | Supported |                                                                                                     |
| GAMMALN                  | Supported |                                                                                                     |
| GAMMALN.PRECISE          | Supported |                                                                                                     |
| GAUSS                    | Supported |                                                                                                     |
| GEOMEAN                  | Supported |                                                                                                     |
| GROWTH                   | Supported |                                                                                                     |
| HARMEAN                  | Supported |                                                                                                     |
| HYPGEOM.DIST             | Supported |                                                                                                     |
| INTERCEPT                | Supported |                                                                                                     |
| KURT                     | Supported |                                                                                                     |
| LARGE                    | Supported |                                                                                                     |
| LINEST                   | Supported |                                                                                                     |
| LOGEST                   | Supported |                                                                                                     |
| LOGNORM.DIST             | Supported |                                                                                                     |
| LOGNORM.INV              | Supported |                                                                                                     |
| MAX                      | Supported |                                                                                                     |
| MAXA                     | Supported |                                                                                                     |
| MAXIFS                   | Supported |                                                                                                     |
| MEDIAN                   | Supported |                                                                                                     |
| MIN                      | Supported |                                                                                                     |
| MINA                     | Supported |                                                                                                     |
| MINIFS                   | Supported |                                                                                                     |
| MODE.MULT                | Supported |                                                                                                     |
| MODE.SNGL                | Supported |                                                                                                     |
| NEGBINOM.DIST            | Supported |                                                                                                     |
| NORM.DIST                | Supported |                                                                                                     |
| NORM.INV                 | Supported |                                                                                                     |
| NORM.S.DIST              | Supported |                                                                                                     |
| NORM.S.INV               | Supported |                                                                                                     |
| PEARSON                  | Supported |                                                                                                     |
| PERCENTILE.EXC           | Supported |                                                                                                     |
| PERCENTILE.INC           | Supported |                                                                                                     |
| PERCENTRANK.EXC          | Supported |                                                                                                     |
| PERCENTRANK.INC          | Supported |                                                                                                     |
| PERMUT                   | Supported |                                                                                                     |
| PERMUTATIONA             | Supported |                                                                                                     |
| PHI                      | Supported |                                                                                                     |
| POISSON.DIST             | Supported |                                                                                                     |
| PROB                     | Supported |                                                                                                     |
| QUARTILE.EXC             | Supported |                                                                                                     |
| QUARTILE.INC             | Supported |                                                                                                     |
| RANK.AVG                 | Supported |                                                                                                     |
| RANK.EQ                  | Supported |                                                                                                     |
| RSQ                      | Supported |                                                                                                     |
| SKEW                     | Supported |                                                                                                     |
| SKEW.P                   | Supported |                                                                                                     |
| SLOPE                    | Supported |                                                                                                     |
| SMALL                    | Supported |                                                                                                     |
| STANDARDIZE              | Supported |                                                                                                     |
| STDEV.P                  | Supported |                                                                                                     |
| STDEV.S                  | Supported |                                                                                                     |
| STDEVA                   | Supported |                                                                                                     |
| STDEVPA                  | Supported |                                                                                                     |
| STEYX                    | Supported |                                                                                                     |
| T.DIST                   | Supported |                                                                                                     |
| T.DIST.2T                | Supported |                                                                                                     |
| T.DIST.RT                | Supported |                                                                                                     |
| T.INV                    | Supported |                                                                                                     |
| T.INV.2T                 | Supported |                                                                                                     |
| T.TEST                   | Supported |                                                                                                     |
| TREND                    | Supported |                                                                                                     |
| TRIMMEAN                 | Supported |                                                                                                     |
| VAR.P                    | Supported |                                                                                                     |
| VAR.S                    | Supported |                                                                                                     |
| VARA                     | Supported |                                                                                                     |
| VARPA                    | Supported |                                                                                                     |
| WEIBULL.DIST             | Supported |                                                                                                     |
| Z.TEST                   | Supported |                                                                                                     |

### Text

| Function       | Status    | Notes                                                                      |
| -------------- | --------- | -------------------------------------------------------------------------- |
| ARRAYTOTEXT    | Supported |                                                                            |
| ASC            | Partial   | Converts full-width ASCII, the ideographic space and katakana.             |
| BAHTTEXT       | Supported |                                                                            |
| CHAR           | Supported |                                                                            |
| CLEAN          | Supported |                                                                            |
| CODE           | Supported |                                                                            |
| CONCAT         | Supported |                                                                            |
| DBCS           | Partial   | Converts ASCII, space and half-width katakana to full width.               |
| DETECTLANGUAGE | Excluded  | Needs Microsoft's online translation service.                              |
| DOLLAR         | Supported |                                                                            |
| EXACT          | Supported |                                                                            |
| FIND           | Supported |                                                                            |
| FINDB          | Partial   | Single-byte semantics.                                                     |
| FIXED          | Supported |                                                                            |
| JIS            | Partial   | Same as DBCS.                                                              |
| LEFT           | Supported |                                                                            |
| LEFTB          | Partial   | Single-byte semantics.                                                     |
| LEN            | Supported |                                                                            |
| LENB           | Partial   | Single-byte semantics (Excel's behaviour without a DBCS editing language). |
| LOWER          | Supported |                                                                            |
| MID            | Supported |                                                                            |
| MIDB           | Partial   | Single-byte semantics.                                                     |
| NUMBERVALUE    | Supported |                                                                            |
| PHONETIC       | Partial   | Cells carry no furigana: returns the text.                                 |
| PROPER         | Supported |                                                                            |
| REGEXEXTRACT   | Supported |                                                                            |
| REGEXREPLACE   | Supported |                                                                            |
| REGEXTEST      | Supported |                                                                            |
| REPLACE        | Supported |                                                                            |
| REPLACEB       | Partial   | Single-byte semantics.                                                     |
| REPT           | Supported |                                                                            |
| RIGHT          | Supported |                                                                            |
| RIGHTB         | Partial   | Single-byte semantics.                                                     |
| SEARCH         | Supported |                                                                            |
| SEARCHB        | Partial   | Single-byte semantics.                                                     |
| SUBSTITUTE     | Supported |                                                                            |
| T              | Supported |                                                                            |
| TEXT           | Supported |                                                                            |
| TEXTAFTER      | Supported |                                                                            |
| TEXTBEFORE     | Supported |                                                                            |
| TEXTJOIN       | Supported |                                                                            |
| TEXTSPLIT      | Supported |                                                                            |
| TRANSLATE      | Excluded  | Needs Microsoft's online translation service.                              |
| TRIM           | Supported |                                                                            |
| UNICHAR        | Supported |                                                                            |
| UNICODE        | Supported |                                                                            |
| UPPER          | Supported |                                                                            |
| VALUE          | Supported |                                                                            |
| VALUETOTEXT    | Supported |                                                                            |

### User defined (add-in and automation)

| Function    | Status    | Notes                            |
| ----------- | --------- | -------------------------------- |
| CALL        | Missing   | Calls native code libraries.     |
| EUROCONVERT | Supported |                                  |
| REGISTER.ID | Missing   | Registers native code libraries. |

### Web

| Function   | Status    | Notes                        |
| ---------- | --------- | ---------------------------- |
| ENCODEURL  | Supported |                              |
| FILTERXML  | Excluded  | Web category (out of scope). |
| WEBSERVICE | Excluded  | Web category (out of scope). |

### Other

| Function   | Status   | Notes                                      |
| ---------- | -------- | ------------------------------------------ |
| COPILOT    | Excluded | Needs Microsoft's AI service.              |
| FIELDVALUE | Missing  | No linked data types (stocks, geography).  |
| PY         | Missing  | Python in Excel runs in Microsoft's cloud. |
