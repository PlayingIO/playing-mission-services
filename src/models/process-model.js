import timestamps from 'mongoose-timestamp';
import { plugins } from 'mostly-feathers-mongoose';
import { models as contents } from 'playing-content-services';
import { models as actions } from 'playing-action-services';

const settings = {
  access: [{ type: 'String', enum: [         // access settings with which the process instance can be created
    'public',
    'protected',
    'private'
  ]}],
  maxGlobal: { type: 'Number' },             // maximun number of instances can be created
  maxActive: { type: 'Number' },             // maximun number of active instances can be created
  maxPlayer: { type: 'Number' },             // maximun number of instances can be created by a player
  maxActivePlayer: { type: 'Number' },       // maximun number of active instances can be created by a player
  requires: actions.rule.requires,           // creation requirements
};

const lane = {
  name: { type: 'String' },                  // name for the lane
  default: { type: 'Boolean' },              // automatically join this lane when join the instance
};

// activity structure
const activity = {
  name: { type: 'String', required: true },  // name for the activity
  type: { type: 'String', enum: [            // type of the activity
    'task', 'subprocess'
  ]},
  lane: { type: 'String' },                  // lane in which the activity belongs to
  loop: { type: 'Number' },                  // number of times a player can perform this task
  rewards: actions.rule.rewards,             // rewards which the player can earn upon completing this task
  requires: actions.rule.requires,           // requirements for performing the task
  probabilty: { type: 'Number' },            // chance [0, 1] that the player will get any of the rewards on completing the task
  activities: { type: 'Mixed' },             // nested subprocess structure
};

// gateway structure
const gateway = {
  name: { type: 'String', required: true },  // name for the gateway
  type: { type: 'String', enum: [            // type of the gateway
    'parallel', 'exclusive'
  ]},
  lane: { type: 'String' },                  // lane in which the activity belongs to
};

// Sequence flows structure
const sequenceflow = {
  from: { type: 'String', required: true },   // node from which the sequence flow originates
  to: { type: 'String', required: true },     // node to which the sequence flow originates
  retry: { type: 'Boolean' },                 // whether the player can retry a task if he fails
  lane: { type: 'String' },                   // lane in which the activity belongs to
};

/*
 * Definition of the process to structure the player activities
 */
const fields = {
  name: { type: 'String', required: true },  // name for the process
  description: { type: 'String' },           // brief description of the process
  image: contents.blob.schema,               // image which represents the process
  settings: settings,                        // settings for the whole process
  lanes: [lane],                             // lanes for retricting players
  activities: [activity],                    // tasks or sub-processes within a process
  gateways: [gateway],                       // gateway for retricting the access to tasks and sub-processes based on the process state
  sequenceflows: [sequenceflow],             // lightweight objects which connect other nodes (activities, gateways) to each other
};

export default function model (app, name) {
  const mongoose = app.get('mongoose');
  const schema = new mongoose.Schema(fields);
  schema.plugin(timestamps);
  schema.plugin(plugins.softDelete);
  return mongoose.model(name, schema);
}

model.schema = fields;