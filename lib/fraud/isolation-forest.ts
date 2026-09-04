import { mulberry32, type Rng } from "./rng"

// A real Isolation Forest (Liu, Ting & Zhou, 2008). Unsupervised: it isolates
// points with short random-partition path lengths. We keep it deliberately
// "boring and well-understood" rather than an LLM pretending to detect anomalies.

const EULER = 0.5772156649015329

// Average path length of an unsuccessful BST search over n points — the
// normalization constant c(n).
function cFactor(n: number): number {
  if (n <= 1) return 0
  return 2 * (Math.log(n - 1) + EULER) - (2 * (n - 1)) / n
}

type Node =
  | { leaf: true; size: number }
  | { leaf: false; attr: number; split: number; left: Node; right: Node }

function buildTree(data: number[][], rng: Rng, height: number, maxHeight: number): Node {
  const n = data.length
  if (height >= maxHeight || n <= 1) return { leaf: true, size: n }

  const dims = data[0].length
  const attr = Math.floor(rng() * dims)
  let min = Infinity
  let max = -Infinity
  for (const row of data) {
    const v = row[attr]
    if (v < min) min = v
    if (v > max) max = v
  }
  if (min === max) return { leaf: true, size: n }

  const split = min + rng() * (max - min)
  const left: number[][] = []
  const right: number[][] = []
  for (const row of data) {
    if (row[attr] < split) left.push(row)
    else right.push(row)
  }
  return {
    leaf: false,
    attr,
    split,
    left: buildTree(left, rng, height + 1, maxHeight),
    right: buildTree(right, rng, height + 1, maxHeight),
  }
}

function pathLength(x: number[], node: Node, height: number): number {
  if (node.leaf) return height + cFactor(node.size)
  return x[node.attr] < node.split
    ? pathLength(x, node.left, height + 1)
    : pathLength(x, node.right, height + 1)
}

export interface IsolationForest {
  score: (x: number[]) => number
  numTrees: number
  sampleSize: number
}

export interface IFConfig {
  numTrees: number
  sampleSize: number
  seed: number
}

export const DEFAULT_IF: IFConfig = { numTrees: 120, sampleSize: 256, seed: 0xf0e57a }

export function fitIsolationForest(train: number[][], cfg: IFConfig = DEFAULT_IF): IsolationForest {
  const rng = mulberry32(cfg.seed)
  const psi = Math.min(cfg.sampleSize, train.length)
  const maxHeight = Math.ceil(Math.log2(Math.max(2, psi)))
  const norm = cFactor(psi)
  const trees: Node[] = []

  for (let t = 0; t < cfg.numTrees; t++) {
    // Random subsample without replacement (Fisher–Yates partial shuffle).
    const idx = train.map((_, i) => i)
    for (let i = 0; i < psi; i++) {
      const j = i + Math.floor(rng() * (idx.length - i))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    const sample = idx.slice(0, psi).map((i) => train[i])
    trees.push(buildTree(sample, rng, 0, maxHeight))
  }

  return {
    numTrees: cfg.numTrees,
    sampleSize: psi,
    score: (x: number[]) => {
      let sum = 0
      for (const tree of trees) sum += pathLength(x, tree, 0)
      const eh = sum / trees.length
      return Math.pow(2, -eh / norm) // 0..1, higher = more anomalous
    },
  }
}
