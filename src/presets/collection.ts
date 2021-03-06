import { editDistance } from '../helpers/editDistance';
import { uniq } from '../helpers/uniq';
import { values } from '../helpers/values';
import { filter } from '../helpers/filter';

export function presetCollection(collection: Array<any>) {
  var maxSearchResults = 50,
    maxSuggestionResults = 10;

  var presets = {
    collection: collection,

    item: function(id) {
      return this.collection.find(function(d) {
        return d.id === id;
      });
    },

    matchGeometry: function(geometry) {
      return presetCollection(
        this.collection.filter(function(d) {
          return d.matchGeometry(geometry);
        })
      );
    },

    search: function(value, geometry) {
      if (!value) return this;

      function leading(a) {
        var index = a.indexOf(value);
        return index === 0 || a[index - 1] === ' ';
      }

      function suggestionName(name) {
        var nameArray = name.split(' - ');
        if (nameArray.length > 1) {
          name = nameArray.slice(0, nameArray.length - 1).join(' - ');
        }
        return name.toLowerCase();
      }

      value = value.toLowerCase();

      var searchable = filter(this.collection, function(a) {
          return a.searchable !== false && a.suggestion !== true;
        }),
        suggestions = filter(this.collection, function(a) {
          return a.suggestion === true;
        });

      // matches value to preset.name
      var leading_name = filter(searchable, function(a) {
        return leading(a.name().toLowerCase());
      }).sort(function(a, b) {
        var aCompare = a.name().toLowerCase(),
          bCompare = b.name().toLowerCase(),
          i;

        // priority if search string matches preset name exactly - #4325
        if (value === aCompare) return -1;
        if (value === bCompare) return 1;

        // priority for higher matchScore
        i = b.originalScore - a.originalScore;
        if (i !== 0) return i;

        // priority if search string appears earlier in preset name
        i = aCompare.indexOf(value) - bCompare.indexOf(value);
        if (i !== 0) return i;

        // priority for shorter preset names
        return a.name().length - b.name().length;
      });

      // matches value to preset.terms values
      var leading_terms = filter(searchable, function(a) {
        const terms = a.terms();
        return terms ? terms.some(leading) : false;
      });

      // matches value to preset.tags values
      var leading_tag_values = filter(searchable, function(a) {
        return values(a.tags || {})
          .filter(r => r !== '*')
          .some(leading);
      });

      // finds close matches to value in preset.name
      var similar_name = searchable
        .map(function(a) {
          return {
            preset: a,
            dist: editDistance(value, a.name())
          };
        })
        .filter(function(a) {
          return (
            a.dist + Math.min(value.length - a.preset.name().length, 0) < 3
          );
        })
        .sort(function(a, b) {
          return a.dist - b.dist;
        })
        .map(function(a) {
          return a.preset;
        });

      // finds close matches to value in preset.terms
      var similar_terms = filter(searchable, function(a) {
        return (a.terms() || []).some(function(b) {
          return (
            editDistance(value, b) + Math.min(value.length - b.length, 0) < 3
          );
        });
      });

      var leading_suggestions = filter(suggestions, function(a) {
        return leading(suggestionName(a.name()));
      }).sort(function(a, b) {
        a = suggestionName(a.name());
        b = suggestionName(b.name());
        var i = a.indexOf(value) - b.indexOf(value);
        if (i === 0) return a.length - b.length;
        else return i;
      });

      var similar_suggestions = suggestions
        .map(function(a) {
          return {
            preset: a,
            dist: editDistance(value, suggestionName(a.name()))
          };
        })
        .filter(function(a) {
          return (
            a.dist +
              Math.min(
                value.length - suggestionName(a.preset.name()).length,
                0
              ) <
            1
          );
        })
        .sort(function(a, b) {
          return a.dist - b.dist;
        })
        .map(function(a) {
          return a.preset;
        });

      var other = presets.item(geometry);

      var results = leading_name
        .concat(
          leading_terms,
          leading_tag_values,
          leading_suggestions.slice(0, maxSuggestionResults + 5),
          similar_name,
          similar_terms,
          similar_suggestions.slice(0, maxSuggestionResults)
        )
        .slice(0, maxSearchResults - 1);

      return presetCollection(uniq(results.concat(other)));
    }
  };

  return presets;
}
