import assert from 'assert';
import makeDebug from 'debug';
import { helpers } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';

import defaultHooks from './user-approval.hooks';

const debug = makeDebug('playing:mission-services:users/approvals');

const defaultOptions = {
  name: 'users/approvals'
};

export class UserApprovalService {
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
  return new UserApprovalService(options);
}

init.Service = UserApprovalService;
