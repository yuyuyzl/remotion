export const defaultOverrideFunction = (config:any) => config;
let overrideArgsFn = defaultOverrideFunction;
let overrideCFFn = defaultOverrideFunction;

export const getFfmpegArgsOverrideFn = () => {
    return overrideArgsFn;
};

export const overrideFfmpegArgs = (fn:any) => {
    overrideArgsFn = fn;
};

export const getFfmpegComplexFilterOverrideFn = () => {
    return overrideCFFn;
};

export const overrideFfmpegComplexFilter = (fn:any) => {
    overrideCFFn = fn;
};
