import { observable, action, reaction } from 'mobx';
import agent from '../agent';

const LIMIT = 10;

export class ArticlesStore {

  @observable isLoading = false;
  @observable page = 0;
  @observable totalPagesCount = 0;
  @observable articles = [];
  @observable articlesRegistry = observable.map();
  @observable predicate = {};

  clear() {
    this.articles = [];
    this.articlesRegistry.clear();
    this.page = 0;
  }

  getArticle(slug) {
    return this.articlesRegistry.get(slug);
  }

  @action setPage(page) {
    this.page = page;
  }

  @action setPredicate(predicate) {
    if (JSON.stringify(predicate) === JSON.stringify(this.predicate)) return;
    this.clear();
    this.predicate = predicate;
  }

  @action updatePredicate(predicate) {
    const newPredicate = Object.assign({}, this.predicate, predicate);
    if (JSON.stringify(newPredicate) === JSON.stringify(this.predicate)) return;
    this.clear();
    this.predicate = newPredicate;
  }

  $req() {
    if (this.predicate.myFeed) return agent.Articles.feed(this.page, LIMIT);
    if (this.predicate.favoritedBy) return agent.Articles.favoritedBy(this.predicate.favoritedBy, this.page, LIMIT);
    if (this.predicate.tag) return agent.Articles.byTag(this.predicate.tag, this.page, LIMIT);
    if (this.predicate.author) return agent.Articles.byAuthor(this.predicate.author, this.page, LIMIT);
    return agent.Articles.all(this.page, LIMIT, this.predicate);
  }

  @action loadArticles() {
    this.isLoading = true;
    return this.$req()
      .then(action(({ articles, articlesCount }) => {
        this.articles = articles;
        this.articlesRegistry.clear();
        articles.forEach(article => this.articlesRegistry.set(article.slug, article));
        this.totalPagesCount = Math.ceil(articlesCount / LIMIT);
      }))
      .finally(action(() => { this.isLoading = false; }));
  }

  @action loadArticle(slug, { acceptCached = false } = {}) {
    if (acceptCached) {
      const article = this.getArticle(slug);
      if (article) return Promise.resolve(article);
    }
    this.isLoading = true;
    return agent.Articles.get(slug)
      .then(action(({ article }) => {
        this.articlesRegistry.set(article.slug, article);
        return article;
      }))
      .finally(action(() => { this.isLoading = false; }));
  }

  @action makeFavorite(slug) {
    const article = this.articles.find(a => a.slug === slug);
    if (article && !article.favorited) {
      article.favorited = true;
      article.favoritesCount++;
      return agent.Articles.favorite(slug)
        .catch(action(err => {
          article.favorited = false;
          article.favoritesCount--;
          throw err;
        }));
    }
    return Promise.resolve();
  }

  @action unmakeFavorite(slug) {
    const article = this.articles.find(a => a.slug === slug);
    if (article && article.favorited) {
      article.favorited = false;
      article.favoritesCount--;
      return agent.Articles.unfavorite(slug)
        .catch(action(err => {
          article.favorited = true;
          article.favoritesCount++;
          throw err;
        }));
    }
    return Promise.resolve();
  }

  @action createArticle(article) {
    agent.Articles.create(article)
      .then(({ article }) => {
        this.articlesRegistry.set(article.slug, article);
        return article;
      })
  }

  @action updateArticle(article) {
    agent.Articles.update(data)
      .then(({ article }) => {
        this.articles = this.articles.map(a => a.slug === article.slug ? article : a);
        this.articlesRegistry.set(article.slug, article);
        return article;
      })
  }

  @action deleteArticle(slug) {
    const idx = this.articles.findIndex(c => c.slug === slug);
    if (idx > -1) this.articles.splice(idx, 1);
    this.articlesRegistry.delete(slug);
    return agent.Articles.del(slug)
      .catch(action(err => { this.loadArticles(); throw err; }));
  }
}

export default new ArticlesStore();
