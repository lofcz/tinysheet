/**
 * Per-function argument traits used by the evaluator:
 *
 * - `arrayParams(key)`: which parameters accept arrays / references. A
 *   parameter that does not is "scalar": when a 2D array is passed there the
 *   evaluator calls the function once per element and returns a same-shaped
 *   array (Excel's implicit lifting: ABS({-1,2}), ROUND(A1:A3,0)).
 *
 *   The default for built-in functions (formulajs and ./functions) is that
 *   every parameter is scalar. ARRAY_PARAMS below lists the exceptions:
 *   aggregates (SUM, COUNT, SUMPRODUCT, ...), lookup/array functions, the
 *   functions that already lift themselves (the text functions in
 *   ../functions/text.js, INDEX, ...) and the array parameters of otherwise
 *   scalar functions (MATCH's lookup_array, NPV's values, ...).
 *
 *   A function may declare its own traits with an `arrayParams` property:
 *   `true` (no lifting at all), or the list of array-accepting parameter
 *   indexes (the other ones are lifted). The property is read from the
 *   ../functions entry and from functions registered with
 *   `Parser#setFunction`; host functions with a non-Excel name are never
 *   lifted unless they declare it.
 *
 * - `unionPolicy(key)`: how a multi-area reference (`(A1:A2,C1:C2)`) is
 *   passed: "spread" as one argument per area (variadic aggregates),
 *   "flatten" as a single row of all values (LARGE, RANK, ...), otherwise
 *   #VALUE!.
 *
 * - `wrapsReference(key, index)`: aggregates that must see a single-cell
 *   reference as a 1x1 array, so that text and logicals in referenced cells
 *   are ignored while typed arguments are coerced (SUM(A1) with A1 = TRUE is
 *   0, SUM(TRUE) is 1, SUM("abc") is #VALUE!).
 */
import LEGACY_FUNCTION_NAMES from "../functions/legacy";

const ALL = true;

// Every parameter is scalar (lifted).
const LIFT_ALL = () => false;

function from(start) {
  return (index) => index >= start;
}

function list(...indexes) {
  return (index) => indexes.indexOf(index) !== -1;
}

// SUMIFS(sum_range, criteria_range1, criteria1, ...): criteria are scalar.
const SUMIFS_LIKE = (index) => index === 0 || index % 2 === 1;
const COUNTIFS_LIKE = (index) => index % 2 === 0;

function names(text) {
  return text.trim().split(/\s+/);
}

const ARRAY_PARAMS = Object.create(null);

function define(nameList, spec) {
  names(nameList).forEach((name) => {
    ARRAY_PARAMS[name] = spec;
  });
}

// Aggregates and multi-array statistics: every argument takes arrays.
define(
  `SUM AVERAGE AVERAGEA COUNT COUNTA COUNTBLANK MAX MAXA MIN MINA PRODUCT
   SUMSQ MEDIAN MODE MODE.SNGL MODE.MULT MODESNGL MODEMULT STDEV STDEV.S
   STDEV.P STDEVS STDEVP STDEVA STDEVPA VAR VAR.S VAR.P VARS VARP VARA VARPA
   AVEDEV DEVSQ GEOMEAN HARMEAN KURT SKEW SKEW.P SKEWP GCD LCM IMSUM
   IMPRODUCT AND OR XOR CONCAT MULTINOMIAL SUMPRODUCT SUMX2MY2 SUMX2PY2
   SUMXMY2 CORREL COVAR COVARIANCE.P COVARIANCE.S COVARIANCEP COVARIANCES
   PEARSON RSQ SLOPE INTERCEPT STEYX MMULT MDETERM MINVERSE MUNIT TRANSPOSE
   FREQUENCY LINEST LOGEST TREND GROWTH PERCENTOF SUBTOTAL AGGREGATE
   GROUPBY PIVOTBY FORECAST.ETS FORECAST.ETS.CONFINT FORECAST.ETS.SEASONALITY
   FORECAST.ETS.STAT`,
  ALL
);

// Lookup, dynamic-array and self-lifting functions.
define(
  `XLOOKUP XMATCH MATCH VLOOKUP HLOOKUP LOOKUP INDEX FILTER SORT SORTBY
   UNIQUE SEQUENCE RANDARRAY TAKE DROP EXPAND TOCOL TOROW WRAPROWS WRAPCOLS
   CHOOSEROWS CHOOSECOLS HSTACK VSTACK TRIMRANGE ARRAYTOTEXT TEXTJOIN
   TEXTSPLIT TEXTBEFORE TEXTAFTER REGEXTEST REGEXEXTRACT REGEXREPLACE
   REGEXMATCH VALUETOTEXT NUMBERVALUE UNICHAR UNICODE FIND SEARCH SUBSTITUTE
   PROPER CLEAN TRIM LEFT RIGHT MID REPT EXACT LEN VALUE`,
  ALL
);

// Higher-order, lazy and reference functions.
define(
  `MAP REDUCE SCAN BYROW BYCOL MAKEARRAY LET LAMBDA ISOMITTED IF IFS IFERROR
   IFNA CHOOSE SWITCH ROW COLUMN ROWS COLUMNS AREAS ISREF TYPE CELL OFFSET
   INDIRECT ISFORMULA FORMULATEXT SHEET SHEETS`,
  ALL
);

// Database functions.
define(
  `DAVERAGE DCOUNT DCOUNTA DGET DMAX DMIN DPRODUCT DSTDEV DSTDEVP DSUM DVAR
   DVARP`,
  ALL
);

// Scalar functions with array parameters.
define("LARGE SMALL TRIMMEAN Z.TEST ZTEST IRR MIRR", list(0));
define(
  `PERCENTILE PERCENTILE.INC PERCENTILE.EXC PERCENTILEINC PERCENTILEEXC
   QUARTILE QUARTILE.INC QUARTILE.EXC QUARTILEINC QUARTILEEXC PERCENTRANK
   PERCENTRANK.INC PERCENTRANK.EXC PERCENTRANKINC PERCENTRANKEXC`,
  list(0)
);
define("RANK RANK.EQ RANK.AVG RANKEQ RANKAVG FVSCHEDULE", list(1));
define("PROB CHISQ.TEST CHITEST F.TEST FTEST T.TEST TTEST XIRR", list(0, 1));
define("COUNTIF", list(0));
define("FORECAST FORECAST.LINEAR XNPV", list(1, 2));
define("SUMIF AVERAGEIF", list(0, 2));
define("SUMIFS AVERAGEIFS MAXIFS MINIFS", SUMIFS_LIKE);
define("COUNTIFS", COUNTIFS_LIKE);
define("NPV", from(1));
define("SERIESSUM", list(3));
define("NETWORKDAYS WORKDAY", list(2));
define("NETWORKDAYS.INTL NETWORKDAYSINTL WORKDAY.INTL WORKDAYINTL", list(3));

function canonical(key) {
  return ARRAY_PARAMS[key] === void 0 && LEGACY_FUNCTION_NAMES[key]
    ? LEGACY_FUNCTION_NAMES[key]
    : key;
}

/**
 * Normalize an `arrayParams` declaration (true / index list / predicate).
 *
 * @param {*} spec
 * @returns {Boolean|Function|null} true: nothing is lifted; a predicate
 *   telling whether a parameter index accepts arrays; null: invalid.
 */
export function normalizeArrayParams(spec) {
  if (spec === true) {
    return ALL;
  }
  if (spec === false) {
    return LIFT_ALL;
  }
  if (Array.isArray(spec)) {
    return list(...spec);
  }
  if (typeof spec === "function") {
    return spec;
  }

  return null;
}

/**
 * Array-parameter traits of a built-in function.
 *
 * @param {String} key Upper-case function name.
 * @returns {Boolean|Function} true when no parameter is lifted, otherwise a
 *   predicate `(index) => acceptsArrays`.
 */
export function builtinArrayParams(key) {
  const spec = ARRAY_PARAMS[canonical(key)];

  return spec === void 0 ? LIFT_ALL : spec;
}

const SPREAD_UNION = new Set(
  names(
    `SUM AVERAGE AVERAGEA COUNT COUNTA COUNTBLANK MAX MAXA MIN MINA PRODUCT
     SUMSQ MEDIAN MODE MODE.SNGL MODE.MULT STDEV STDEV.S STDEV.P STDEVP
     STDEVA STDEVPA VAR VAR.S VAR.P VARP VARA VARPA AVEDEV DEVSQ GEOMEAN
     HARMEAN KURT SKEW SKEW.P AND OR XOR GCD LCM CONCAT SUBTOTAL`
  )
);

const FLATTEN_UNION = new Set(
  names(
    `LARGE SMALL RANK RANK.EQ RANK.AVG PERCENTILE PERCENTILE.INC
     PERCENTILE.EXC QUARTILE QUARTILE.INC QUARTILE.EXC PERCENTRANK
     PERCENTRANK.INC PERCENTRANK.EXC TRIMMEAN FREQUENCY AGGREGATE`
  )
);

/**
 * @param {String} key Upper-case function name.
 * @returns {"spread"|"flatten"|null}
 */
export function unionPolicy(key) {
  const name = canonical(key);

  if (SPREAD_UNION.has(name)) {
    return "spread";
  }
  if (FLATTEN_UNION.has(name)) {
    return "flatten";
  }

  return null;
}

const WRAP_ALL = new Set(
  names(
    `SUM AVERAGE AVERAGEA COUNT MAX MAXA MIN MINA PRODUCT SUMSQ MEDIAN MODE
     MODE.SNGL MODE.MULT STDEV STDEV.S STDEV.P STDEVP STDEVA STDEVPA VAR
     VAR.S VAR.P VARP VARA VARPA`
  )
);

const WRAP_FROM = { SUBTOTAL: 1, NPV: 1, AGGREGATE: 2 };

/**
 * Whether a single-cell reference passed at `index` must reach the function
 * as a 1x1 array (reference semantics) rather than as a typed scalar.
 *
 * @param {String} key Upper-case function name.
 * @param {Number} index
 * @returns {Boolean}
 */
export function wrapsReference(key, index) {
  const name = canonical(key);

  if (WRAP_ALL.has(name)) {
    return true;
  }
  const start = WRAP_FROM[name];

  return start !== void 0 && index >= start;
}
