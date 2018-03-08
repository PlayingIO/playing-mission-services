import { plugins } from 'mostly-feathers-mongoose';

const options = {
  timestamps: true
};

/*
 * mission instance structure
 */
const fields = {
  mission: { type: 'ObjectId', required: true },  // id of the mission definition
  access: { type: String, enum: [                 // access of the mission instance
    'public', 'protected', 'private'
  ], required: true },
  state: { type: String, enum: [                  // state of the mission instance
    'ready',                                      // task can be performed
    'completed',                                  // task being finished
    'active'                                      // task being performed but not completed
  ]},
  loop: { type: Number },                         // number of times the player has perfomed this task
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