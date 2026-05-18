function buildValidator(fields) {
  return (req, res, next) => {
    const body = req.body || {};
    const errors = [];

    for (const [field, def] of Object.entries(fields || {})) {
      if (typeof def !== 'object' || def === null || Array.isArray(def)) continue;

      const value = body[field];
      const type = def.type;

      if (def.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value === undefined || value === null || value === '') continue;

      if (type === 'String' || typeof value === 'string') {
        const str = String(value);
        if (def.minLength !== undefined && str.length < def.minLength) {
          errors.push(`${field} must be at least ${def.minLength} characters`);
        }
        if (def.maxLength !== undefined && str.length > def.maxLength) {
          errors.push(`${field} must be at most ${def.maxLength} characters`);
        }
        if (def.enum && !def.enum.includes(str)) {
          errors.push(`${field} must be one of: ${def.enum.join(', ')}`);
        }
      }

      if (type === 'Number' || typeof value === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`${field} must be a number`);
        } else {
          if (def.min !== undefined && num < def.min) {
            errors.push(`${field} must be at least ${def.min}`);
          }
          if (def.max !== undefined && num > def.max) {
            errors.push(`${field} must be at most ${def.max}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(422).json({ error: 'Validation failed', details: errors });
    }
    next();
  };
}

module.exports = { buildValidator };
