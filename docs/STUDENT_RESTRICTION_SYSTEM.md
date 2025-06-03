# Student Restriction System

The granular student restriction system provides a comprehensive approach to managing student access to exams with four levels of restrictions:

## Restriction Types

1. **Exam Ban**: Student is banned from a specific exam only
   - Duration: 2 hours by default
   - Use case: Minor violations during a specific exam
   - Scope: Limited to one exam

2. **Account Suspension**: Student's account is temporarily suspended across all exams
   - Duration: 1 hour to 1 week depending on severity
   - Use case: Moderate violations or repeated minor violations
   - Scope: All exams but temporary

3. **IP Ban**: Network-based restriction
   - Duration: 24 hours by default
   - Use case: Suspected shared device abuse or network-level violations
   - Scope: All users from specific IP address

4. **Global Ban**: Permanent account termination
   - Duration: Permanent by default (can be reversed by admin)
   - Use case: Severe violations or repeated major violations
   - Scope: Complete account restriction

## Key Features

- **Auto-escalation**: Violations automatically escalate from exam ban to global ban based on frequency and severity
- **Admin Appeals Processing**: Students can submit appeals that admins can review and approve/reject
- **Comprehensive Logging**: All restriction actions are logged with timestamps and admin details
- **Restriction Statistics**: Dashboards for monitoring restriction patterns and effectiveness

## Integration Points

The restriction system is integrated with:

1. **Socket Connection Management**: All socket connections are validated against student restrictions
2. **Anti-abuse System**: Security violations can trigger appropriate restriction levels
3. **Exam Monitoring**: Students are checked for restrictions before monitoring can begin
4. **Admin Dashboard**: Provides UI for managing all restriction types

## API Endpoints

### Admin Endpoints

- `GET /api/admin/student-restrictions/` - Get all restrictions with filters
- `POST /api/admin/student-restrictions/impose` - Create new restriction
- `DELETE /api/admin/student-restrictions/:restrictionId` - Remove restriction
- `GET /api/admin/student-restrictions/student/:studentId` - Get student restrictions
- `PUT /api/admin/student-restrictions/:restrictionId/appeal` - Process appeal
- `GET /api/admin/student-restrictions/stats` - Get statistics
- `POST /api/admin/student-restrictions/check-access/:studentId/:examId` - Check access

## Usage Guidelines

1. **Start with least restrictive** measure (exam ban) for first-time minor violations
2. **Investigate patterns** before applying account suspensions
3. **Reserve global bans** for the most severe cases with clear evidence
4. **Consider appeals** and review each case individually
5. **Document all restriction decisions** for audit purposes

## Implementation Details

The system is implemented through:

- `studentRestriction.model.js` - Data model for restrictions
- `studentRestrictionManager.js` - Business logic for restriction management
- `admin.studentRestrictions.controller.js` - Admin API endpoints
- Integration with Socket, Anti-abuse, and Monitoring systems
