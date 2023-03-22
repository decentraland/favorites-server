export class ListNotFoundError extends Error {
  constructor(public listId: string) {
    super('The favorites list was not found.')
  }
}

export class PickAlreadyExistsError extends Error {
  constructor(public listId: string, public itemId: string) {
    super('The item was already favorited.')
  }
}

export class ItemNotFoundError extends Error {
  constructor(public itemId: string) {
    super("The item trying to get favorited doesn't exist.")
  }
}

export class PickNotFoundError extends Error {
  constructor(public listId: string, public itemId: string) {
    super('The pick does not exist or is not accessible by this user.')
  }
}

export class QueryFailure extends Error {
  constructor(message: string) {
    super(`Querying the subgraph failed: ${message}`)
  }
}
