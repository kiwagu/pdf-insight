import { defineEntityPrefixes, isEntityId } from 'entity-id';

export const idRegistry = defineEntityPrefixes({ analysis: 'ana', request: 'req' } as const);

const { analysisIdFactory, requestIdFactory } = idRegistry.factories;

export const createAnalysisId = (): string => analysisIdFactory.create();
export const createRequestId = (): string => requestIdFactory.create();
export const isAnalysisId = (value: string): boolean =>
  isEntityId(value) && analysisIdFactory.is(value);
