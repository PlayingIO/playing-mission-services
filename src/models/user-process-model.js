import timestamps from 'mongoose-timestamp';
import { plugins } from 'mostly-feathers-mongoose';

/*
 * process instance structure
 */
const fields = {
  process: { type: 'ObjectId' },             // id of the process definition
  state: { type: 'String', enum: [           // state of the process instance
    'ready',                                 // task can be performed
    'completed',                             // task being finished
    'active'                                 // task being performed but not completed
  ]},
  loop: { type: 'Number' },                  // number of times the player has perfomed this task
  perfomers: [{                              // players within this task who have performed this task at least once
    id: { type: 'ObjectId' },                // id of the performer
    lanes: [{
      name: { type: 'String' },
      role: { type: 'String' },
    }]
  }],
  owner: { type: 'ObjectId' },               // owner of the process
};

export default function model (app, name) {
  const mongoose = app.get('mongoose');
  const schema = new mongoose.Schema(fields);
  schema.plugin(timestamps);
  schema.plugin(plugins.softDelete);
  return mongoose.model(name, schema);
}

model.schema = fields;