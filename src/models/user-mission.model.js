import { plugins } from 'mostly-feathers-mongoose';
import { models as rules } from 'playing-rule-services';

const options = {
  timestamps: true
};

/**
 * task is a activity being performed by user
 */
const task = {
  _id: false,
  key: { type: String, required: true },          // path to an actity in mission's activities, eg. "1.0.2" means activities[1][0][2]
  name: { type: String, required: true },         // name of the activity to check if mismatched with key
  state: { type: String, enum: [                  // state of the task
    'ready',                                      // task can be performed
    'completed',                                  // all task being finished
    'active'                                      // task in progress (looped task or has unfinished nested tasks)
  ]},
  loop: { type: Number },                         // number of times the task has performed
  limit: { type: rules.limit.schema },            // rate limiting data
  performers: [{                                  // players within this task who have performed this task at least once
    _id: false,
    user: { type: 'ObjectId' },                   // id of the performer
    scopes: [{ type: String }]                    // custom leaderboard scopes which the task performed with
  }]
};

/**
 * mission instance structure
 */
const fields = {
  mission: { type: 'ObjectId', required: true },  // id of the mission definition
  access: { type: String, enum: [                 // access of the mission instance
    'public', 'protected', 'private'
  ], required: true },
  state: { type: String, enum: [                  // state of the mission instance
    'ready',                                      // mission can be performed
    'completed',                                  // mission being finished
    'active'                                      // mission in progress
  ]},
  tasks: [task],                                  // tasks in this mission (defined by activities)
  performers: [{                                  // players within this task who have performed this task at least once
    _id: false,
    user: { type: 'ObjectId' },                   // id of the performer
    lanes: [{                                     // lane/role of the performer
      _id: false,
      lane: { type: String },
      role: { type: String, enum: [
        'observer', 'player'
      ]},
    }]
  }],
  owner: { type: 'ObjectId' },                    // owner of the mission
};

export default function model (app, name) {
  const mongoose = app.get('mongoose');
  const schema = new mongoose.Schema(fields, options);
  schema.plugin(plugins.softDelete);
  return mongoose.model(name, schema);
}

model.schema = fields;