export type BaseTrainingMetrics = {
  algorithm: string;
  wallTimeSec?: number;
  steps?: number;
  epochs?: number;
  artifactPath?: string;
};

export type SupervisedDatasetStats = {
  samples: { train: number; val?: number; test?: number };
};

export type SupervisedMetrics = BaseTrainingMetrics & SupervisedDatasetStats & {
  loss: number;
  acc?: number;
  valLoss?: number;
  valAcc?: number;
  testAcc?: number;
};

export type RLMetrics = BaseTrainingMetrics & {
  avgReward?: number;
  policyLoss?: number;
  valueLoss?: number;
  entropy?: number;
};

export function makeSupervisedMetrics(params: {
  loss: number;
  acc?: number;
  valLoss?: number;
  valAcc?: number;
  testAcc?: number;
  samples: { train: number; val?: number; test?: number };
  wallTimeSec?: number;
  epochs?: number;
  artifactPath?: string;
  algorithm?: string;
}): SupervisedMetrics {
  return {
    algorithm: params.algorithm ?? 'supervised',
    loss: params.loss,
    acc: params.acc,
    valLoss: params.valLoss,
    valAcc: params.valAcc,
    testAcc: params.testAcc,
    samples: params.samples,
    wallTimeSec: params.wallTimeSec,
    epochs: params.epochs,
    artifactPath: params.artifactPath,
  };
}

export function makeRLMetrics(params: {
  steps?: number;
  avgReward?: number;
  policyLoss?: number;
  valueLoss?: number;
  entropy?: number;
  wallTimeSec?: number;
  artifactPath?: string;
  algorithm?: string;
}): RLMetrics {
  return {
    algorithm: params.algorithm ?? 'rl/ppo',
    steps: params.steps,
    avgReward: params.avgReward,
    policyLoss: params.policyLoss,
    valueLoss: params.valueLoss,
    entropy: params.entropy,
    wallTimeSec: params.wallTimeSec,
    artifactPath: params.artifactPath,
  };
}
