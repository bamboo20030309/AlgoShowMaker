const { analyzeSource, instrumentSource } = require('./trace-instrumenter');

function analyzeTraceSource(code) {
  analyzeSource(code);
  const instrumented = instrumentSource(code, []);
  return {
    success: true,
    layouts: instrumented.layoutDirectives,
    branches: instrumented.branchDirectives.map(directive => ({
      type: directive.type,
      line: directive.line,
      label: directive.label || '',
      layoutId: directive.layoutId || '',
    })),
    frameDirectives: instrumented.frameDirectives
      .filter(directive => directive.silentKeepView !== true)
      .map(directive => ({
      line: directive.line,
      name: directive.name || '',
      objectId: directive.objectId || '',
      layoutId: directive.layoutId || '',
      names: directive.names,
      variableIds: directive.variables.map(variable => variable.id),
      captureOnlyVariableIds: directive.captureOnlyVariableIds || [],
      lets: directive.lets || [],
      bindings: directive.bindings || [],
      objectBinding: directive.objectBinding || null,
      placeBindings: directive.placeBindings || [],
      renderer: directive.renderer || '',
      rendererOptions: directive.rendererOptions || {},
      dataTransform: directive.dataTransform || null,
      objects: (directive.objects || []).map(object => ({
        line: object.line,
        frameSpec: object.frameSpec || '',
        objectId: object.objectId || '',
        layoutId: object.layoutId || '',
        primaryVariableId: object.primaryVariableId || '',
        primaryName: object.primaryName || '',
        displayVariableIds: object.displayVariableIds || [],
        renderer: object.renderer || '',
        rendererOptions: object.rendererOptions || {},
        dataTransform: object.dataTransform || null,
        objectBinding: object.objectBinding || null,
      })),
      when: directive.when || null,
      texts: directive.texts || [],
      styles: directive.styles || [],
      segments: directive.segments || [],
      arrows: directive.arrows || [],
      eventControls: directive.eventControls || [],
      autoMarkVariableIds: directive.autoMarkVariableIds,
      camera: directive.camera || null,
      presetDirectives: directive.presetDirectives || [],
    })),
    variables: instrumented.variables.map(variable => ({
      id: variable.id,
      name: variable.name,
      cppType: variable.type,
      kind: variable.kind,
      line: variable.line,
      functionName: variable.functionName,
      supported: variable.supported,
    })),
  };
}

module.exports = { analyzeTraceSource };
