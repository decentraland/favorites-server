export class ForbiddenLists extends Error {
  constructor() {
    super('The user does not have access to one or more of the lists.')
  }
}
