export class ModelUnavailable extends Error {
  constructor(msg) { super(msg); this.name = 'ModelUnavailable'; }
}
/** Provider contract: { name, isStub, available(): boolean, complete({system,user,maxTokens,temperature}): Promise<{text}> } */
export const unavailableProvider = (why = 'no provider configured') => ({
  name: 'unavailable', isStub: false, available: () => false,
  complete: async () => { throw new ModelUnavailable(why); },
});
