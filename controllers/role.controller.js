const Role = require('../models/role.model');
const Permission = require('../models/permissions.model');
const User = require('../models/user.model');

// Create a new role
const createRole = async (req, res) => {
  try {
    const { id, name, description } = req.body;
    
    // Check if role already exists
    const existingRole = await Role.findOne({ $or: [{ id }, { name }] });
    if (existingRole) {
      return res.status(400).json({ 
        message: 'Role already exists with this ID or name'
      });
    }
    
    const role = new Role({ id, name, description });
    await role.save();
    
    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      role
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create role',
      error: error.message
    });
  }
};

// Get all roles
const getRoles = async (req, res) => {
  try {
    const roles = await Role.find({});
    res.status(200).json({
      success: true,
      count: roles.length,
      roles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roles',
      error: error.message
    });
  }
};

// Get a single role by ID
const getRole = async (req, res) => {
  try {
    const { id } = req.params;
    
    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }
    
    res.status(200).json({
      success: true,
      role
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch role',
      error: error.message
    });
  }
};

// Update a role
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Check if updating name and if it already exists
    if (updateData.name) {
      const existingRole = await Role.findOne({ 
        name: updateData.name,
        _id: { $ne: id }
      });
      
      if (existingRole) {
        return res.status(400).json({
          success: false,
          message: 'Role with this name already exists'
        });
      }
    }
    
    const role = await Role.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Role updated successfully',
      role
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update role',
      error: error.message
    });
  }
};

// Delete a role
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if role is assigned to any users
    const permissions = await Permission.find({ roleId: id });
    if (permissions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete role assigned to users',
        count: permissions.length
      });
    }
    
    const role = await Role.findByIdAndDelete(id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete role',
      error: error.message
    });
  }
};

// Assign role to user
const assignRole = async (req, res) => {
  try {
    const { userId, roleId } = req.body;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if role exists
    const role = await Role.findOne({ id: roleId });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }
    
    // Check if permission already exists
    const existingPermission = await Permission.findOne({ userId });
    
    if (existingPermission) {
      // Update existing permission
      existingPermission.roleId = roleId;
      await existingPermission.save();
    } else {
      // Create new permission
      const permission = new Permission({
        userId,
        roleId,
      });
      await permission.save();
    }
    
    // Update user's isAdmin status if role is admin
    user.isAdmin = role.name === 'admin';
    await user.save();
    
    res.status(200).json({
      success: true,
      message: `User assigned to ${role.name} role successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to assign role',
      error: error.message
    });
  }
};

module.exports = {
  createRole,
  getRoles,
  getRole,
  updateRole,
  deleteRole,
  assignRole
}; 