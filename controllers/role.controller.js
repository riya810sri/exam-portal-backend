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
    const { userId, roleId, rolename } = req.body;
    
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
    user.role = rolename; 
    await user.save();  // Ensure the user document is saved with the new role
    // Update user's role field
    
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

// Check if user has a specific role
const hasRole = async (req, res) => {
  try {
    const { userId, roleId } = req.query;
    
    // Validate required parameters
    if (!userId || !roleId) {
      return res.status(400).json({
        success: false,
        message: 'userId and roleId are required'
      });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        hasRole: false
      });
    }
    
    // Check if role exists
    const role = await Role.findOne({ id: parseInt(roleId) });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
        hasRole: false
      });
    }
    
    // Check if user has the specified role
    const permission = await Permission.findOne({ 
      userId: userId,
      roleId: parseInt(roleId)
    });
    
    const hasTheRole = permission ? true : false;
    
    res.status(200).json({
      success: true,
      hasRole: hasTheRole,
      user: {
        id: user._id,
        email: user.email,
        username: user.username
      },
      role: {
        id: role.id,
        name: role.name,
        description: role.description
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check user role',
      hasRole: false,
      error: error.message
    });
  }
};

// Get user with all assigned roles
const getUserWithRoles = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const user = await User.findById(userId).select('_id email username firstName lastName isAdmin role createdAt');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get all permissions for this user
    const permissions = await Permission.find({ userId: userId });
    
    // Get role details for each permission
    const rolePromises = permissions.map(permission => 
      Role.findOne({ id: permission.roleId })
    );
    
    const roles = await Promise.all(rolePromises);
    
    // Filter out any null roles (in case of orphaned permissions)
    const validRoles = roles.filter(role => role !== null);
    
    // Format the response
    const userWithRoles = {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        userRole: user.role, // Built-in user role field
        createdAt: user.createdAt
      },
      assignedRoles: validRoles.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description
      })),
      roleCount: validRoles.length,
      hasAnyRole: validRoles.length > 0
    };
    
    res.status(200).json({
      success: true,
      data: userWithRoles
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user roles',
      error: error.message
    });
  }
};

// Get all users with their assigned roles
const getAllUsersWithRoles = async (req, res) => {
  try {
    // Get all users
    const users = await User.find({}).select('_id email username firstName lastName isAdmin role createdAt');
    
    // Get all permissions
    const permissions = await Permission.find({});
    
    // Get all roles
    const roles = await Role.find({});
    
    // Create a map of roleId to role object for quick lookup
    const roleMap = {};
    roles.forEach(role => {
      roleMap[role.id] = role;
    });
    
    // Group permissions by userId
    const userPermissions = {};
    permissions.forEach(permission => {
      if (!userPermissions[permission.userId]) {
        userPermissions[permission.userId] = [];
      }
      userPermissions[permission.userId].push(permission);
    });
    
    // Format response for each user
    const usersWithRoles = users.map(user => {
      const userPerms = userPermissions[user._id.toString()] || [];
      const userRoles = userPerms.map(perm => roleMap[perm.roleId]).filter(role => role);
      
      return {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin,
          userRole: user.role,
          createdAt: user.createdAt
        },
        assignedRoles: userRoles.map(role => ({
          id: role.id,
          name: role.name,
          description: role.description
        })),
        roleCount: userRoles.length,
        hasAnyRole: userRoles.length > 0
      };
    });
    
    res.status(200).json({
      success: true,
      totalUsers: users.length,
      data: usersWithRoles
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users with roles',
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
  assignRole,
  hasRole,
  getUserWithRoles,
  getAllUsersWithRoles
}; 