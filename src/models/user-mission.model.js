const { plugins } = require('mostly-feathers-mongoose');
const { schemas: rules } = require('playing-rule-common');

const options = {
  timestamps: true
};

/**
 * Task is a activity being performed by user
 */
const task = {
  _id: false,
  key: { type: String, required: true },            // path to an actity in mission's activities, eg. "1.0.2" means activities[1][0][2]
  name: { type: String, required: true },           // name of the activity to check if mismatched with key
  state: { type: String, enum: [                    // state of the task
    'READY',                                        // task can be performed
    'COMPLETED',                                    // all task being finished
    'ACTIVE'                                        // task in progress (looped task or has unfinished nested tasks)
  ]},
  loop: { type: Number },                           // number of times the task has performed
  limit: { type: rules.limit.schema },              // rate limiting data
  performers: [{                                    // players within this task who have performed this task at least once
    _id: false,
    user: { type: String },                         // id of the performer
    scopes: [{ type: String }]                      // custom leaderboard scopes which the task performed with
  }]
};

/**
 * mission instance structure
 */
const fields = {
  definition: { type: 'ObjectId', required: true }, // id of the mission definition
  access: { type: String, enum: [                   // access of the mission instance
    'PUBLIC', 'PROTECTED', 'PRIVATE'
  ], required: true },
  state: { type: String, enum: [                    // state of the mission instance
    'READY',                                        // mission can be performed
    'COMPLETED',                                    // mission being finished
    'ACTIVE'                                        // mission in progress
  ]},
  tasks: [task],                                    // tasks in this mission (defined by activities)
  performers: [{                                    // players within this task who have performed this task at least once
    _id: false,
    user: { type: String },                         // id of the performer
    lanes: { type: 'Mixed' }                        // lane/role map of the performer
  }],
  owner: { type: String },                          // owner of the mission
};

module.exports = function model (app, name) {
  const mongoose = app.get('mongoose');
  const schema = new mongoose.Schema(fields, options);
  schema.plugin(plugins.trashable);
  return mongoose.model(name, schema);
};
module.exports.schema = fields;