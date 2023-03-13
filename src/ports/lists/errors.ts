export class ListNotFoundError extends Error {
  constructor(public listId: string) {
    super("The favorites list was not found.")
  }
}

export class PickAlreadyExistsError extends Error {
  constructor(public listId: string, public itemId: string) {
    super("The item was already favorited.")
  }
}

export class ItemNotFoundError extends Error {
  constructor(public itemId: string) {
    super("The item trying to get favorited doesn't exist.")
  }
}
