import { plugins } from 'mostly-feathers-mongoose';

const options = {
  timestamps: true
};

/*
 * mission instance structure
 */
const fields = {
  mission: { type: 'ObjectId' },             // id of the mission definition
  state: { type: String, enum: [             // state of the mission instance
    'ready',                                 // task can be performed
    'completed',                             // task being finished
    'active'                                 // task being performed but not completed
  ]},
  loop: { type: Number },                    // number of times the player has perfomed this task
  perfomers: [{                              // players within this task who have performed this task at least once
    id: { type: 'ObjectId' },                // id of the performer
    lanes: [{
      name: { type: String },
      role: { type: String },
    }]
  }],
  owner: { type: 'ObjectId' },               // owner of the mission
};

export default function model (app, name) {
  const mongoose = app.get('mongoose');
  const schema = new mongoose.Schema(fields, options);
  schema.plugin(plugins.softDelete);
  return mongoose.model(name, schema);
}

model.schema = fields;