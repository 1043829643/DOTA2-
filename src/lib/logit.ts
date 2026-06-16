/**
 * Lightweight logistic regression (IRLS / Newton-Raphson) in pure TypeScript.
 * Mirrors the methodology of analyze_custom_matchup_logit.py for the web dashboard.
 * Designed for a small number of predictors (k <= ~8); matrices are solved directly.
 */

export interface LogitResult {
  /** beta[0] = intercept, beta[1..k] = coefficients (per 1 gold) */
  beta: number[];
  /** standard errors aligned with beta */
  standardErrors: number[];
  /** predicted probability per sample (training) */
  probabilities: number[];
  sampleCount: number;
  positiveRate: number;
  auc: number;
  accuracy: number;
  mcfaddenR2: number;
  converged: boolean;
}

function clampExp(value: number): number {
  return Math.max(-35, Math.min(35, value));
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-clampExp(value)));
}

/** Solve A x = b for x via Gaussian elimination with partial pivoting. */
function solve(matrix: number[][], vector: number[]): number[] | null {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col] / a[col][col];
      for (let k = col; k <= n; k += 1) {
        a[row][k] -= factor * a[col][k];
      }
    }
  }
  return a.map((row, i) => row[n] / a[i][i]);
}

/** Invert a square matrix via Gauss-Jordan; returns null if singular. */
function invert(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  const a = matrix.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const pivotValue = a[col][col];
    for (let k = 0; k < 2 * n; k += 1) a[col][k] /= pivotValue;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let k = 0; k < 2 * n; k += 1) a[row][k] -= factor * a[col][k];
    }
  }
  return a.map((row) => row.slice(n));
}

/** Mann-Whitney AUC with tie-averaged ranks. */
export function aucScore(y: number[], probabilities: number[]): number {
  const positives = y.reduce((sum, value) => sum + (value === 1 ? 1 : 0), 0);
  const negatives = y.length - positives;
  if (positives === 0 || negatives === 0) return Number.NaN;
  const order = probabilities
    .map((p, index) => ({ p, index }))
    .sort((a, b) => a.p - b.p);
  const ranks = new Array<number>(probabilities.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].p === order[i].p) j += 1;
    const averageRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) ranks[order[k].index] = averageRank;
    i = j + 1;
  }
  let rankSumPositive = 0;
  for (let k = 0; k < y.length; k += 1) {
    if (y[k] === 1) rankSumPositive += ranks[k];
  }
  return (rankSumPositive - (positives * (positives + 1)) / 2) / (positives * negatives);
}

/** Two-sided p-value from a z statistic (normal approximation). */
export function normalTwoSidedP(z: number): number {
  return erfc(Math.abs(z) / Math.SQRT2);
}

function erfc(x: number): number {
  // Numerical Recipes erfcc: fractional error < 1.2e-7 across the whole range,
  // so tiny tail probabilities (e.g. 1e-40) are represented correctly.
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const poly =
    -1.26551223 +
    t * (1.00002368 +
    t * (0.37409196 +
    t * (0.09678418 +
    t * (-0.18628806 +
    t * (0.27886807 +
    t * (-1.13520398 +
    t * (1.48851587 +
    t * (-0.82215223 +
    t * 0.17087277))))))));
  const ans = t * Math.exp(-z * z + poly);
  return x >= 0 ? ans : 2 - ans;
}

export interface FitOptions {
  l2?: number;
  maxIter?: number;
  tol?: number;
}

/**
 * Fit a logistic regression. x is an n*k matrix (no intercept column), y is 0/1.
 * Returns null when the data cannot support a fit (too few samples / single class).
 */
export function fitLogistic(x: number[][], y: number[], options: FitOptions = {}): LogitResult | null {
  const sampleCount = x.length;
  const featureCount = sampleCount > 0 ? x[0].length : 0;
  if (sampleCount <= featureCount + 1) return null;
  const positives = y.reduce((sum, value) => sum + (value === 1 ? 1 : 0), 0);
  if (positives === 0 || positives === sampleCount) return null;

  const l2 = options.l2 ?? 1e-6;
  const maxIter = options.maxIter ?? 100;
  const tol = options.tol ?? 1e-9;
  const dimension = featureCount + 1;

  const design = x.map((row) => [1, ...row]);
  let beta = new Array<number>(dimension).fill(0);
  let converged = false;

  for (let iter = 0; iter < maxIter; iter += 1) {
    const probability = design.map((row) => sigmoid(dot(row, beta)));
    const gradient = new Array<number>(dimension).fill(0);
    const hessian = Array.from({ length: dimension }, () => new Array<number>(dimension).fill(0));

    for (let s = 0; s < sampleCount; s += 1) {
      const row = design[s];
      const p = probability[s];
      const weight = p * (1 - p);
      const residual = y[s] - p;
      for (let a = 0; a < dimension; a += 1) {
        gradient[a] += row[a] * residual;
        for (let b = 0; b < dimension; b += 1) {
          hessian[a][b] += row[a] * row[b] * weight;
        }
      }
    }
    // ridge on non-intercept terms
    for (let a = 1; a < dimension; a += 1) {
      gradient[a] -= l2 * beta[a];
      hessian[a][a] += l2;
    }

    const step = solve(hessian, gradient);
    if (!step) break;
    let maxStep = 0;
    for (let a = 0; a < dimension; a += 1) {
      beta[a] += step[a];
      maxStep = Math.max(maxStep, Math.abs(step[a]));
    }
    if (maxStep < tol) {
      converged = true;
      break;
    }
  }

  const probabilities = design.map((row) => sigmoid(dot(row, beta)));

  // covariance = inverse of (X^T W X + ridge)
  const hessian = Array.from({ length: dimension }, () => new Array<number>(dimension).fill(0));
  for (let s = 0; s < sampleCount; s += 1) {
    const row = design[s];
    const p = probabilities[s];
    const weight = p * (1 - p);
    for (let a = 0; a < dimension; a += 1) {
      for (let b = 0; b < dimension; b += 1) {
        hessian[a][b] += row[a] * row[b] * weight;
      }
    }
  }
  for (let a = 1; a < dimension; a += 1) hessian[a][a] += l2;
  const covariance = invert(hessian);
  const standardErrors = covariance
    ? covariance.map((row, i) => Math.sqrt(Math.max(0, row[i])))
    : new Array<number>(dimension).fill(Number.NaN);

  const positiveRate = positives / sampleCount;
  const base = Math.min(1 - 1e-15, Math.max(1e-15, positiveRate));
  let llModel = 0;
  let correct = 0;
  for (let s = 0; s < sampleCount; s += 1) {
    const p = Math.min(1 - 1e-15, Math.max(1e-15, probabilities[s]));
    llModel += y[s] * Math.log(p) + (1 - y[s]) * Math.log(1 - p);
    if ((p >= 0.5 ? 1 : 0) === y[s]) correct += 1;
  }
  const llNull = sampleCount * (base * Math.log(base) + (1 - base) * Math.log(1 - base));

  return {
    beta,
    standardErrors,
    probabilities,
    sampleCount,
    positiveRate,
    auc: aucScore(y, probabilities),
    accuracy: correct / sampleCount,
    mcfaddenR2: llNull !== 0 ? 1 - llModel / llNull : Number.NaN,
    converged,
  };
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

/** Predicted win probability for given predictor values (per-1-gold beta). */
export function predictProbability(beta: number[], values: number[]): number {
  let eta = beta[0];
  for (let i = 0; i < values.length; i += 1) eta += beta[i + 1] * values[i];
  return sigmoid(eta);
}
