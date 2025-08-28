const functions = new Map();

export function registerFunction(name, description, parameters, handler) {
  if (!name || typeof handler !== 'function') {
    throw new Error('Invalid function registration');
  }
  functions.set(name, { description, parameters, handler });
}

export function listDeclarations() {
  return Array.from(functions.entries()).map(([name, { description, parameters }]) => ({
    name,
    description,
    parameters
  }));
}

export async function execute(functionCall) {
  const { name, args } = functionCall;
  const fn = functions.get(name);
  if (!fn) {
    throw new Error(`Function '${name}' is not registered`);
  }
  return await fn.handler(args || {});
}

export default { registerFunction, listDeclarations, execute };

