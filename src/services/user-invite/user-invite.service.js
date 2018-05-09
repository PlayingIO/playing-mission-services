import assert from 'assert';
import makeDebug from 'debug';
import { helpers } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';

import defaultHooks from './user-invite.hooks';

const debug = makeDebug('playing:mission-services:users/invites');

const defaultOptions = {
  name: 'users/invites'
};

export class UserInviteService {
  constructor (options) {
    this.options = fp.assign(defaultOptions, options);
    this.name = this.options.name;
  }

  setup (app) {
    this.app = app;
    this.hooks(defaultHooks(this.options));
  }
}

export default function init (app, options, hooks) {
  return new UserInviteService(options);
}

init.Service = UserInviteService;
