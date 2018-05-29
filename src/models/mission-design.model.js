import { plugins } from 'mostly-feathers-mongoose';
import { models as contents } from 'playing-content-services';
import { schemas as rules } from 'playing-rule-common';

import { activity } from './activity.schema';

const options = {
  timestamps: true
};

const settings = {
  maxMissions: { type: Number },           // maximun number of instances can be created
  maxActive: { type: Number },             // maximun number of active instances can be created
  maxPlayerMissions: { type: Number },     // maximun number of instances can be created by a player
  maxPlayerActive: { type: Number },       // maximun number of active instances can be created by a player
  requires: rules.requires.schema,         // creation requirements
};

const lane = {
  _id: false,
  name: { type: String },                  // name for the lane
  default: { type: Boolean },              // automatically join this lane when join the instance
};

/**
 * Definition of the mission to structure the player activities
 */
const fields = {
  name: { type: String, required: true },  // name for the mission
  description: { type: String },           // brief description of the mission
  image: contents.blob.schema,             // image which represents the mission
  access: [{ type: String, enum: [         // access settings with which the mission instance can be created
    'PUBLIC', 'PROTECTED', 'PRIVATE'
  ]}],
  settings: settings,                      // settings for the whole mission
  lanes: [lane],                           // lanes for retricting players
  activities: [activity],                  // activities nodes within a mission
  tags: [{ type: String }],                // tags of the mission
};

export default function model (app, name) {
  const mongoose = app.get('mongoose');
  const schema = new mongoose.Schema(fields, options);
  schema.plugin(plugins.softDelete);
  return mongoose.model(name, schema);
}

model.schema = fields;