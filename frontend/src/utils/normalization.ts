export type NormalizationType = 
  | 'div_max' 
  | 'min_max'
  | 'z_score' 
  | 'cooc_cosine' 
  | 'cooc_association' 
  | 'cooc_jaccard' 
  | 'cooc_inclusion'
  | 'bipartite_row'
  | 'bipartite_col'
  | 'bipartite_sym';

export interface NormalizationInfo {
  type: NormalizationType;
  params: any;
}

export interface NormalizationResult {
  normalizedMatrix: number[][];
  scalerInfo: NormalizationInfo;
}

const cloneMatrix = (matrix: number[][]): number[][] => {
  return matrix.map(row => [...row]);
};

export const divideByMax = (matrix: number[][]): NormalizationResult => {
  if (!matrix || matrix.length === 0) return { normalizedMatrix: [], scalerInfo: { type: 'div_max', params: {} } };

  const cols = matrix[0].length;
  const maxValues = new Array(cols).fill(Number.NEGATIVE_INFINITY);

  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < cols; c++) {
      if (matrix[r][c] > maxValues[c]) {
        maxValues[c] = matrix[r][c];
      }
    }
  }

  // Prevent division by zero
  const safeMaxValues = maxValues.map(v => v === 0 ? 1 : v);
  const normalizedMatrix = cloneMatrix(matrix);

  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < cols; c++) {
      normalizedMatrix[r][c] = matrix[r][c] / safeMaxValues[c];
    }
  }

  return {
    normalizedMatrix,
    scalerInfo: {
      type: 'div_max',
      params: { maxValues: safeMaxValues }
    }
  };
};

export const minMaxScale = (matrix: number[][]): NormalizationResult => {
  if (!matrix || matrix.length === 0) return { normalizedMatrix: [], scalerInfo: { type: 'min_max', params: {} } };

  const cols = matrix[0].length;
  const maxValues = new Array(cols).fill(Number.NEGATIVE_INFINITY);
  const minValues = new Array(cols).fill(Number.POSITIVE_INFINITY);

  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < cols; c++) {
      if (matrix[r][c] > maxValues[c]) maxValues[c] = matrix[r][c];
      if (matrix[r][c] < minValues[c]) minValues[c] = matrix[r][c];
    }
  }

  const ranges = new Array(cols);
  for (let c = 0; c < cols; c++) {
    const range = maxValues[c] - minValues[c];
    ranges[c] = range === 0 ? 1 : range; // Prevent division by zero
  }

  const normalizedMatrix = cloneMatrix(matrix);
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < cols; c++) {
      normalizedMatrix[r][c] = (matrix[r][c] - minValues[c]) / ranges[c];
    }
  }

  return {
    normalizedMatrix,
    scalerInfo: {
      type: 'min_max',
      params: { minValues, maxValues, ranges }
    }
  };
};

export const zScoreStandardize = (matrix: number[][]): NormalizationResult => {
  if (!matrix || matrix.length === 0) return { normalizedMatrix: [], scalerInfo: { type: 'z_score', params: {} } };

  const rows = matrix.length;
  const cols = matrix[0].length;
  
  const means = new Array(cols).fill(0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      means[c] += matrix[r][c];
    }
  }
  for (let c = 0; c < cols; c++) {
    means[c] /= rows;
  }

  const stdDevs = new Array(cols).fill(0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      stdDevs[c] += Math.pow(matrix[r][c] - means[c], 2);
    }
  }
  // Population standard deviation (as per standard approach, unless bessel is required)
  for (let c = 0; c < cols; c++) {
    stdDevs[c] = Math.sqrt(stdDevs[c] / rows);
  }

  const safeStdDevs = stdDevs.map(v => v === 0 ? 1 : v);
  const normalizedMatrix = cloneMatrix(matrix);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      normalizedMatrix[r][c] = (matrix[r][c] - means[c]) / safeStdDevs[c];
    }
  }

  return {
    normalizedMatrix,
    scalerInfo: {
      type: 'z_score',
      params: { means, stdDevs: safeStdDevs }
    }
  };
};

export const cosineCooccurrence = (matrix: number[][]): NormalizationResult => {
  const normalizedMatrix = cloneMatrix(matrix);
  const rows = matrix.length;
  
  for (let i = 0; i < rows; i++) {
    for (let j = i; j < rows; j++) {
      if (i === j) {
        normalizedMatrix[i][j] = 1;
      } else {
        const temp = matrix[i][j] / Math.sqrt(matrix[i][i] * matrix[j][j]);
        const safeTemp = isNaN(temp) ? 0 : temp;
        normalizedMatrix[i][j] = safeTemp;
        normalizedMatrix[j][i] = safeTemp;
      }
    }
  }
  return { normalizedMatrix, scalerInfo: { type: 'cooc_cosine', params: {} } };
};

export const associationStrengthCooccurrence = (matrix: number[][]): NormalizationResult => {
  const normalizedMatrix = cloneMatrix(matrix);
  const rows = matrix.length;

  for (let i = 0; i < rows; i++) {
    for (let j = i; j < rows; j++) {
      if (i === j) {
        normalizedMatrix[i][j] = 1;
      } else {
        const temp = matrix[i][j] / (matrix[i][i] * matrix[j][j]);
        const safeTemp = isNaN(temp) ? 0 : temp;
        normalizedMatrix[i][j] = safeTemp;
        normalizedMatrix[j][i] = safeTemp;
      }
    }
  }
  return { normalizedMatrix, scalerInfo: { type: 'cooc_association', params: {} } };
};

export const jaccardCooccurrence = (matrix: number[][]): NormalizationResult => {
  const normalizedMatrix = cloneMatrix(matrix);
  const rows = matrix.length;

  for (let i = 0; i < rows; i++) {
    for (let j = i; j < rows; j++) {
      if (i === j) {
        normalizedMatrix[i][j] = 1;
      } else {
        const temp = matrix[i][j] / (matrix[i][i] + matrix[j][j] - matrix[i][j]);
        const safeTemp = isNaN(temp) ? 0 : temp;
        normalizedMatrix[i][j] = safeTemp;
        normalizedMatrix[j][i] = safeTemp;
      }
    }
  }
  return { normalizedMatrix, scalerInfo: { type: 'cooc_jaccard', params: {} } };
};

export const inclusionCooccurrence = (matrix: number[][]): NormalizationResult => {
  const normalizedMatrix = cloneMatrix(matrix);
  const rows = matrix.length;

  for (let i = 0; i < rows; i++) {
    for (let j = i; j < rows; j++) {
      if (i === j) {
        normalizedMatrix[i][j] = 1;
      } else {
        const temp = matrix[i][j] / Math.min(matrix[i][i], matrix[j][j]);
        const safeTemp = isNaN(temp) ? 0 : temp;
        normalizedMatrix[i][j] = safeTemp;
        normalizedMatrix[j][i] = safeTemp;
      }
    }
  }
  return { normalizedMatrix, scalerInfo: { type: 'cooc_inclusion', params: {} } };
};

// Bipartite Normalizations
export const bipartiteRowNormalization = (matrix: number[][]): NormalizationResult => {
  if (!matrix || matrix.length === 0) return { normalizedMatrix: [], scalerInfo: { type: 'bipartite_row', params: {} } };
  
  const normalizedMatrix = cloneMatrix(matrix);
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rowDegrees = new Array(rows).fill(0);

  // Calculate degrees (sum) for each row
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rowDegrees[r] += matrix[r][c];
    }
  }

  // Normalize
  for (let r = 0; r < rows; r++) {
    const degree = rowDegrees[r] === 0 ? 1 : rowDegrees[r]; // Avoid division by zero
    for (let c = 0; c < cols; c++) {
      normalizedMatrix[r][c] = matrix[r][c] / degree;
    }
  }

  return { normalizedMatrix, scalerInfo: { type: 'bipartite_row', params: { rowDegrees } } };
};

export const bipartiteColNormalization = (matrix: number[][]): NormalizationResult => {
  if (!matrix || matrix.length === 0) return { normalizedMatrix: [], scalerInfo: { type: 'bipartite_col', params: {} } };
  
  const normalizedMatrix = cloneMatrix(matrix);
  const rows = matrix.length;
  const cols = matrix[0].length;
  const colDegrees = new Array(cols).fill(0);

  // Calculate degrees (sum) for each column
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      colDegrees[c] += matrix[r][c];
    }
  }

  // Normalize
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const degree = colDegrees[c] === 0 ? 1 : colDegrees[c]; // Avoid division by zero
      normalizedMatrix[r][c] = matrix[r][c] / degree;
    }
  }

  return { normalizedMatrix, scalerInfo: { type: 'bipartite_col', params: { colDegrees } } };
};

export const bipartiteSymNormalization = (matrix: number[][]): NormalizationResult => {
  if (!matrix || matrix.length === 0) return { normalizedMatrix: [], scalerInfo: { type: 'bipartite_sym', params: {} } };
  
  const normalizedMatrix = cloneMatrix(matrix);
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rowDegrees = new Array(rows).fill(0);
  const colDegrees = new Array(cols).fill(0);

  // Calculate degrees for rows and columns
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rowDegrees[r] += matrix[r][c];
      colDegrees[c] += matrix[r][c];
    }
  }

  // Normalize
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rDeg = rowDegrees[r] === 0 ? 1 : rowDegrees[r];
      const cDeg = colDegrees[c] === 0 ? 1 : colDegrees[c];
      normalizedMatrix[r][c] = matrix[r][c] / Math.sqrt(rDeg * cDeg);
    }
  }

  return { normalizedMatrix, scalerInfo: { type: 'bipartite_sym', params: { rowDegrees, colDegrees } } };
};

export const applyNormalizationToMatrix = (matrix: number[][], type: NormalizationType): NormalizationResult => {
  switch (type) {
    case 'div_max': return divideByMax(matrix);
    case 'min_max': return minMaxScale(matrix);
    case 'z_score': return zScoreStandardize(matrix);
    case 'cooc_cosine': return cosineCooccurrence(matrix);
    case 'cooc_association': return associationStrengthCooccurrence(matrix);
    case 'cooc_jaccard': return jaccardCooccurrence(matrix);
    case 'cooc_inclusion': return inclusionCooccurrence(matrix);
    case 'bipartite_row': return bipartiteRowNormalization(matrix);
    case 'bipartite_col': return bipartiteColNormalization(matrix);
    case 'bipartite_sym': return bipartiteSymNormalization(matrix);
    default: return { normalizedMatrix: cloneMatrix(matrix), scalerInfo: { type: 'div_max', params: {} } };
  }
};

export const denormalizeValue = (normVal: number, featureIdx: number, normInfo: NormalizationInfo | null): number => {
  if (!normInfo || !normInfo.type) return normVal;
  const { type, params } = normInfo;

  if (type === 'div_max' && params?.maxValues && params.maxValues[featureIdx] !== undefined) {
    return normVal * params.maxValues[featureIdx];
  }
  if (type === 'min_max' && params?.minValues && params?.ranges && params.minValues[featureIdx] !== undefined) {
    return normVal * params.ranges[featureIdx] + params.minValues[featureIdx];
  }
  if (type === 'z_score' && params?.means && params?.stdDevs && params.means[featureIdx] !== undefined) {
    return normVal * params.stdDevs[featureIdx] + params.means[featureIdx];
  }
  if (type === 'bipartite_col' && params?.colDegrees && params.colDegrees[featureIdx] !== undefined) {
    return normVal * params.colDegrees[featureIdx];
  }
  return normVal;
};

export const denormalizeVector = (normVector: number[], normInfo: NormalizationInfo | null): number[] => {
  if (!normInfo || !normInfo.type) return [...normVector];
  return normVector.map((val, idx) => denormalizeValue(val, idx, normInfo));
};

export type LongitudinalNormalizationType =
  | 'none'
  | 'min_max'
  | 'z_score'
  | 'div_max'
  | 'cooc_association'
  | 'cooc_cosine'
  | 'cooc_jaccard'
  | 'cooc_inclusion';

export interface MultiperiodNormalizationResult {
  normalizedPeriodsData: Record<string, { data: number[][]; labels?: string[]; doc_count?: number }>;
  scalerInfo: {
    type: LongitudinalNormalizationType;
    params: any;
    label: string;
  };
}

/**
 * Normalizes multi-period longitudinal data.
 * For rectangular performance profiles (entities x indicators):
 *   Computes GLOBAL intertemporal parameters across ALL periods combined (min, max, mean, std)
 *   so that values across different years maintain exact absolute scale comparability,
 *   preserving the validity of synaptic drift (\Delta W) and trajectories.
 * For square co-occurrence networks (terms x terms):
 *   Applies co-occurrence similarity normalization per period.
 */
export const applyIntertemporalNormalization = (
  periodsData: Record<string, { data: number[][]; labels?: string[]; doc_count?: number }>,
  type: LongitudinalNormalizationType = 'none'
): MultiperiodNormalizationResult => {
  const pKeys = Object.keys(periodsData).sort();
  if (pKeys.length === 0 || type === 'none') {
    return {
      normalizedPeriodsData: periodsData,
      scalerInfo: {
        type: 'none',
        params: {},
        label: 'Sin normalizar (Rango natural)'
      }
    };
  }

  // Check if network co-occurrence normalization
  if (type.startsWith('cooc_')) {
    const normType = type as NormalizationType;
    const normalizedPeriodsData: Record<string, any> = {};
    const labelsMap: Record<string, string> = {
      cooc_association: 'Fuerza de Asociación (VOSviewer)',
      cooc_cosine: 'Coseno de Salton',
      cooc_jaccard: 'Índice de Jaccard',
      cooc_inclusion: 'Índice de Inclusión'
    };

    for (const p of pKeys) {
      const item = periodsData[p];
      if (!item || !item.data || item.data.length === 0) continue;
      const res = applyNormalizationToMatrix(item.data, normType);
      normalizedPeriodsData[p] = {
        ...item,
        data: res.normalizedMatrix
      };
    }

    return {
      normalizedPeriodsData,
      scalerInfo: {
        type,
        params: {},
        label: labelsMap[type] || type
      }
    };
  }

  // Rectangular performance profiles: global intertemporal scaling
  const samplePeriod = periodsData[pKeys[0]];
  const cols = samplePeriod?.data?.[0]?.length || 0;
  if (cols === 0) {
    return {
      normalizedPeriodsData: periodsData,
      scalerInfo: { type: 'none', params: {}, label: 'Sin normalizar' }
    };
  }

  if (type === 'min_max') {
    const minVals = new Array(cols).fill(Number.POSITIVE_INFINITY);
    const maxVals = new Array(cols).fill(Number.NEGATIVE_INFINITY);

    for (const p of pKeys) {
      const mat = periodsData[p]?.data || [];
      for (let r = 0; r < mat.length; r++) {
        for (let c = 0; c < cols; c++) {
          const val = mat[r][c];
          if (val < minVals[c]) minVals[c] = val;
          if (val > maxVals[c]) maxVals[c] = val;
        }
      }
    }

    const ranges = maxVals.map((max, c) => {
      const range = max - minVals[c];
      return range === 0 ? 1 : range;
    });

    const normalizedPeriodsData: Record<string, any> = {};
    for (const p of pKeys) {
      const item = periodsData[p];
      const mat = item?.data || [];
      const normMat = mat.map(row => row.map((val, c) => (val - minVals[c]) / ranges[c]));
      normalizedPeriodsData[p] = {
        ...item,
        data: normMat
      };
    }

    return {
      normalizedPeriodsData,
      scalerInfo: {
        type: 'min_max',
        params: { minVals, maxVals, ranges },
        label: 'Min-Max Global Intertemporal [0, 1]'
      }
    };
  }

  if (type === 'z_score') {
    let totalCount = 0;
    const sumVals = new Array(cols).fill(0);

    for (const p of pKeys) {
      const mat = periodsData[p]?.data || [];
      for (let r = 0; r < mat.length; r++) {
        totalCount++;
        for (let c = 0; c < cols; c++) {
          sumVals[c] += mat[r][c];
        }
      }
    }

    const safeTotal = totalCount > 0 ? totalCount : 1;
    const means = sumVals.map(s => s / safeTotal);
    const sumSqDiffs = new Array(cols).fill(0);

    for (const p of pKeys) {
      const mat = periodsData[p]?.data || [];
      for (let r = 0; r < mat.length; r++) {
        for (let c = 0; c < cols; c++) {
          sumSqDiffs[c] += Math.pow(mat[r][c] - means[c], 2);
        }
      }
    }

    const stdDevs = sumSqDiffs.map(sq => {
      const sd = Math.sqrt(sq / safeTotal);
      return sd === 0 ? 1 : sd;
    });

    const normalizedPeriodsData: Record<string, any> = {};
    for (const p of pKeys) {
      const item = periodsData[p];
      const mat = item?.data || [];
      const normMat = mat.map(row => row.map((val, c) => (val - means[c]) / stdDevs[c]));
      normalizedPeriodsData[p] = {
        ...item,
        data: normMat
      };
    }

    return {
      normalizedPeriodsData,
      scalerInfo: {
        type: 'z_score',
        params: { means, stdDevs },
        label: 'Z-Score Global Intertemporal (μ=0, σ=1)'
      }
    };
  }

  if (type === 'div_max') {
    const maxVals = new Array(cols).fill(Number.NEGATIVE_INFINITY);

    for (const p of pKeys) {
      const mat = periodsData[p]?.data || [];
      for (let r = 0; r < mat.length; r++) {
        for (let c = 0; c < cols; c++) {
          if (mat[r][c] > maxVals[c]) maxVals[c] = mat[r][c];
        }
      }
    }

    const safeMaxVals = maxVals.map(m => m === 0 ? 1 : m);
    const normalizedPeriodsData: Record<string, any> = {};

    for (const p of pKeys) {
      const item = periodsData[p];
      const mat = item?.data || [];
      const normMat = mat.map(row => row.map((val, c) => val / safeMaxVals[c]));
      normalizedPeriodsData[p] = {
        ...item,
        data: normMat
      };
    }

    return {
      normalizedPeriodsData,
      scalerInfo: {
        type: 'div_max',
        params: { maxValues: safeMaxVals },
        label: 'Dividir por Máximo Global'
      }
    };
  }

  return {
    normalizedPeriodsData: periodsData,
    scalerInfo: { type: 'none', params: {}, label: 'Sin normalizar' }
  };
};

