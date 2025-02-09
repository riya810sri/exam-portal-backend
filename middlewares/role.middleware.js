const Role = require("../models/role.model");

async function createRole(roleId, roleName, description) {
  const role = new Role({
    id: roleId,
    name: roleName,
    description,
  });

  await role.save();
}

module.exports = {
  createRole,
};
