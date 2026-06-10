/**
 * GENERATED — do not edit by hand. Regenerate with:
 *   npx vitest run --reporter=json --outputFile=/tmp/v.json && npx vite-node scripts/emit-case-data.ts
 *
 * Every number is computed live from the shipping engines (500 seeds each) and the test run.
 * This is the data the case study's "the work" section reads, so the page never claims a figure
 * it did not measure.
 */
export interface MeasuredData {
  generatedAt: string
  commit: string
  seeds: number
  tests: { total: number; suites: number; pass: boolean }
  grid: {
    validRate: number
    scoreMin: number
    scoreMean: number
    scoreP10: number
    distinctShapes: number
    topAttractor: number
    programLen: number[]
    multiStage: number
    stages: { lattice: number; spiral: number; echo: number; mirror: number }
  }
  palette: {
    scoreMin: number
    scoreMean: number
    scoreP10: number
    heroMagentaBefore: number
    heroMagentaNow: number
    nearBlack: number
    genre: { spreadHue: number; tightHue: number; neonJewel: number; highKey: number; lowKey: number; figureGround: number }
  }
}

export const MEASURED: MeasuredData = {
  "generatedAt": "2026-06-10",
  "commit": "ad5c1f7",
  "seeds": 500,
  "tests": {
    "total": 235,
    "suites": 99,
    "pass": true
  },
  "grid": {
    "validRate": 100,
    "scoreMin": 0.669,
    "scoreMean": 0.74,
    "scoreP10": 0.708,
    "distinctShapes": 234,
    "topAttractor": 9,
    "programLen": [
      278,
      148,
      57,
      17
    ],
    "multiStage": 44,
    "stages": {
      "lattice": 28,
      "spiral": 16,
      "echo": 10,
      "mirror": 7
    }
  },
  "palette": {
    "scoreMin": 0.71,
    "scoreMean": 0.827,
    "scoreP10": 0.779,
    "heroMagentaBefore": 86,
    "heroMagentaNow": 36,
    "nearBlack": 13,
    "genre": {
      "spreadHue": 36,
      "tightHue": 22,
      "neonJewel": 12,
      "highKey": 6,
      "lowKey": 5,
      "figureGround": 2
    }
  }
}
