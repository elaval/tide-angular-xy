
"use strict";
/* jshint undef: true, unused: true */
/* global angular */

/**
 * @ngdoc directive
 * @name tide-angular.directive:tdXyChart
 * @requires underscore._
 * @requires d3service.d3
 * @requires tideLayoutXY
 * @requires linearRegression
 * @requires toolTip
 * @element div
 * 
 * @param {array} tdData Data array used for populating the chart
 * @param {string} tdXattribute Name of the attribute used for the X values in data objects
 * @param {string} tdYattribute Name of the attribute used for the Y values in data objects
 * @param {string} tdIdAttribute Name of the attribute used for the ID of unique entities in teh data set
 * @param {string} tdSizeAttribute Name of the attribute used for defining the size of the bubbles
 * @param {string} tdColorAttribute Name of the attribute used to define the color categories in the chart
 * @param {boolean=} tdSqrScaleX Indicates if shoudl display x axis using a sqr scale
 * @param {function=} tdTooltipMessage Function that should return a text to be displayed in the tooltip, given a data element
 * @param {int=} tdWidth Chart widht (and height)
 * @param {boolean=} tdTrendline Wether a trendline is displayed in the graph (linear regression)
 * @param {int=} tdMaxSize Maximum size of the bubbles (defaults to 5)
 * @param {int=} tdMinSize Minimun size of the bubbles (defaults to 1)
 * @param {array=} tdColorLegend Array that returns the color codes used in the legend each element is an array ["category", "color"]
 * @param {object=} tdSelected Object with the data element of the selected point in the chart
 * @param {object=} tdOptions Options for chart configuration (i.e. options.margin.left)
 * @description
 *
 * Generates a scatered XY Chart
 *
 */
angular.module("tide-angular")
.directive("tdXyChart",["$compile","_", "d3","tideLayoutXY","linearRegression", "toolTip",function ($compile,_, d3, layout, regression, tooltip) {
 return {
  restrict: "A",
      //transclude: false,
      //template: "<div style='background-color:red' ng-transclude></div>",
      scope: {
        data: "=tdData",
        xAttribute: "=tdXattribute",
        yAttribute: "=tdYattribute",
        idAttribute: "=?tdIdAttribute",
        sqrScaleX: "=?tdSqrScaleX",
        tooltipMessage: "=?tdTooltipMessage",
        highlight: "=tdHighlight",

        width: "=?tdWidth",
        trendline : "=?tdTrendline",

        // Bubble size
        maxSize : "=?tdMaxSize",
        minSize : "=?tdMinSize",
        sizeAttribute: "=?tdSizeAttribute",

        // Bubble color
        colorAttribute: "=?tdColorAttribute",
        colorLegend : "=?tdColorLegend",

        selected: "=?tdSelected",

        options : "=?tdOptions",

        // Indicates wether the chart is being drawn  
        drawing : "=?tdDrawing",

        excludeZeroX : "=?tdExcludeZeroX"
      },
      
      link: function (scope, element, attrs) {
        var width = scope.width ? scope.width : 300;
        var height = scope.width ? scope.width : 300;
        var margin = {};
        margin.left = scope.options && scope.options.margin && scope.options.margin.left ? scope.options.margin.left : 50;
        margin.right = 20;
        margin.top = 20;
        margin.bottom = 20;

        // Default: not drawing
        scope.drawing = false;


        // Setup scope default values if not assigned
        scope.idAttribute = scope.idAttribute ? scope.idAttribute : "id";

        // Define dataPoints tooltip generator
        var dataPointTooltip = tooltip();
        if (scope.tooltipMessage) {
          dataPointTooltip.message(scope.tooltipMessage);
        } else {
          dataPointTooltip.message(function(d) {
            var msg = scope.xAttribute + " : " + d[scope.xAttribute];
            msg += "<br>" + scope.yAttribute +  " : " + d[scope.yAttribute];

            return  msg;
          });
        }


        // Define trendLine tooltip generator
        var trendlineTooltip = tooltip();
        trendlineTooltip.message(function(d) {
          var formatDecimal = d3.format(".2f");
          var formatDecimal4 = d3.format(".4f");

          var slopeMsg = d.slope > 0.01 ? formatDecimal(d.slope) : formatDecimal4(d.slope);
          var interceptMsg = d.intercept > 0.01 ? formatDecimal(d.intercept) : formatDecimal4(d.intercept);

          var msg = "y = "+slopeMsg+"*X +"+interceptMsg+"<br>";
          msg += "R2: "+formatDecimal(d.r2*100)+"%<br>";

          return  msg;
        });


        var svgContainer = d3.select(element[0])
          .append("svg")
          .attr("width", width+margin.left+margin.right)
          .attr("height", height+margin.top+margin.bottom)
          .append("g")
          .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var svgXAxis = svgContainer.append("g")
        .attr("class", "x axis")
        .attr("transform","translate(0," + height + ")")
        .attr("stroke-width", "1.5px")
        ;
        var svgYAxis = svgContainer.append("g")
        .attr("class", "y axis");


        var svgXAxisText = svgXAxis
        .append("text")
        .attr("class", "label")
        .attr("x", width )
        .attr("y", -6)
        .style("text-anchor", "end")
        .text(scope.xAttribute);

        var svgYAxisText = svgYAxis
        .append("text")
        .attr("class", "label")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text(scope.yAttribute);

        var trendLine = svgContainer.select(".trendline");

        var circles = svgContainer.selectAll("circle");


        var render = function(data) {
          if (data) {
            data = _.filter(data, function(d,i) {
              var accepted = true;

              if (scope.excludeZeroX) {
                accepted = accepted && (+d[scope.xAttribute] > 0);
              }
              return accepted;
            });

            if (data.length) {scope.drawing = true;}
            
            scope.maxSize = scope.maxSize ? scope.maxSize : 5;
            scope.minSize = scope.minSize ? scope.minSize : 1;

            // sizeScale - defines the size fo each bubble
            var sizeScale=d3.scale.linear().range([scope.minSize, scope.maxSize]);
            if (scope.sizeAttribute) {
              sizeScale.domain(d3.extent(data, function(d) {return +d[scope.sizeAttribute];}));
            } else {
              sizeScale.domain([1,1]).range([scope.maxSize, scope.maxSize]);
            }            

            layout
            .size([width, height])
            .xAttribute(scope.xAttribute)
            .yAttribute(scope.yAttribute)
            .sizeAttribute(scope.sizeAttribute)
            .useLog(scope.sqrScaleX)
            .sizeScale(sizeScale);


            var nodes = layout.nodes(data);

            //var xAxis = d3.svg.axis().scale(layout.xScale()).ticks(7).tickFormat(d3.format("d")).tickSubdivide(0);
            //var yAxis = d3.svg.axis().scale(layout.yScale()).orient("left").ticks(7).tickFormat(d3.format("d")).tickSubdivide(0);



            var digitWidth = 25;
            var xMaxDigits = Math.ceil(Math.log(Math.abs(layout.xScale().domain()[1]))/Math.log(10));
            var yMaxDigits = Math.ceil(Math.log(Math.abs(layout.yScale().domain()[1]))/Math.log(10));
            var xlabelLength = digitWidth*xMaxDigits;
            var ylabelLength = digitWidth*yMaxDigits;

            var xNumberOfTicks = (layout.xScale().range()[1]-layout.xScale().range()[0])/xlabelLength;
            var yNumberOfTicks = (Math.abs(layout.yScale().range()[1]-layout.yScale().range()[0]))/ylabelLength;
 

            var xDomainRange = Math.abs(layout.xScale().domain()[1]-layout.xScale().domain()[0]);
            var yDomainRange = Math.abs(layout.yScale().domain()[1]-layout.yScale().domain()[0]);

            var xFormat = xDomainRange/xNumberOfTicks > 1 ? d3.format("d") : d3.format(".1f");
            var yFormat = yDomainRange/yNumberOfTicks > 1 ? d3.format("d") : d3.format(".1f");


            var xAxis = d3.svg.axis().scale(layout.xScale()).ticks(xNumberOfTicks).tickFormat(xFormat).tickSubdivide(0);
            var yAxis = d3.svg.axis().scale(layout.yScale()).orient("left").ticks(yNumberOfTicks).tickFormat(yFormat).tickSubdivide(0);
            var colorScale = d3.scale.category10();

            // Information sent back with color legen data [{key:keyName, color:colorCode, n:numberOfRecords}, ...]
            scope.colorLegend = [];

            // Asign colors according to alphabetical order to avoid inconsistency
            if (scope.colorAttribute) {
              var groupsByColorAttribute = _.groupBy(data, function(d) {return d[scope.colorAttribute]});

              var colorDomain = _.keys(groupsByColorAttribute).sort();
              colorScale.domain(colorDomain);

              _.each(colorDomain, function(d) {
                scope.colorLegend.push({key:d, color:colorScale(d), n:groupsByColorAttribute[d].length});
              })
            }




            svgXAxis    
              .call(xAxis);

            svgXAxis.selectAll("path, line")
              .attr("fill","none")
              .attr("stroke", "black");

            svgYAxis
            .call(yAxis);

            svgYAxis.selectAll("path, line")
              .attr("fill","none")
              .attr("stroke", "black");

            circles = svgContainer.selectAll("circle")
            .data(nodes, function(d) {return d[scope.idAttribute];});

            circles.exit()
              .transition()
              .attr("r",0)
              .attr("cx",0)
              .attr("cy", height)
              .remove();

            circles.enter()
              .append("circle")
              .attr("cx", function(d) {
                return 0;
              })
              .attr("cy", function(d) {
                return height;
              })
              .attr("r", function(d) {
                return 0
              })              
              .attr("opacity", 0.8)
              .on("click", function(d) {
                if ((!scope.selected) || ((scope.selected[scope.idAttribute]) && (d[scope.idAttribute] != scope.selected[scope.idAttribute]))) {
                  // Select the node - save in the scope 
                  scope.$apply(function(){
                    scope.selected = d;
                  });
                } else {
                  // Unselect the node 
                  scope.$apply(function(){
                    scope.selected = null;
                  });
                }

              })              
              .on("mouseenter", function(d) {
                dataPointTooltip.show(d);
              })
              .on("mouseleave", function() {
                dataPointTooltip.hide();
              });

            circles
            .sort(function(a, b) {return scope.selected && a[scope.idAttribute] == scope.selected[scope.idAttribute]? 1 : scope.selected && b[scope.idAttribute] == scope.selected[scope.idAttribute] ? -1 : 0})
            .transition()
            .duration(0)
            .attr("cx", function(d) {
              return d.x;
            })
            .attr("cy", function(d) {
              return d.y;
            })
            .attr("r", function(d) {
              return  scope.selected && (d[scope.idAttribute] == scope.selected[scope.idAttribute]) ? 2*d.r : d.r
            })
            .attr("stroke-width", function(d) {
              return scope.selected && (d[scope.idAttribute] == scope.selected[scope.idAttribute])? 2 : 1;
            })
            .attr("fill", function(d) {
              return colorScale(d[scope.colorAttribute])
            })
            .attr("stroke", function(d) { return d3.rgb(colorScale(d[scope.colorAttribute])).darker(2); })
            .each("end", function() {
              scope.drawing = false;
              scope.$apply();
            })       

            svgXAxisText
              .text(scope.xAttribute);

            svgYAxisText
              .text(scope.yAttribute);

            // Trend Line - Linear Regression
            var datapoints = _.map(nodes, function(d) {return [+d[scope.xAttribute], +d[scope.yAttribute]];});
            var regObject = regression(datapoints);


           var line = d3.svg.line()
                .interpolate("basis");


          //Redraw trendline to place it on top of datapoints
          trendLine.remove();

          if (scope.trendline) {
            trendLine = svgContainer
              .append("path")
                .datum(regObject)
                .attr("class", "trendLine")
                .attr("stroke", "red")
                .attr("stroke-width", 4)
                .attr("fill", "none")
                .attr("opacity", 0.8)

                .attr("d", function(d) {
                  var trendlinePoints = _.map(d.points, function(d) {return [layout.xScale()(d[0]), layout.yScale()(d[1])];});
                  trendlinePoints = _.sortBy(trendlinePoints, function(d) {return d[0];});
                  return line(trendlinePoints);
                })
                .on("mouseenter", function(d) {
                  trendlineTooltip.show(d);
                })
                .on("mouseleave", function() {
                  trendlineTooltip.hide();
                });
          }

          }

          
        };

        scope.$watch("data", function () {
          render(scope.data);
        });      

        scope.$watch("sqrScaleX", function () {
          render(scope.data);
        });

        scope.$watch("selected", function () {
          render(scope.data);
        });

        scope.$watch("colorAttribute", function () {
          render(scope.data);
        });

        scope.$watch("excludeZeroX", function () {
          render(scope.data);
        });

        scope.$watch("xAttribute", function () {
          render(scope.data);
        });

        scope.$watch("yAttribute", function () {
          render(scope.data);
        });


      }
      
      
    };
  }]);


/**
* @ngdoc service
* @name tide-angular.tideLayoutXY
* @requires d3service.d3
* @requires underscore._
*
* @description
* Creates a layout (node array with position attributes) for building an XY bubble chart
*
*/
angular.module("tide-angular")
.service ("tideLayoutXY", ["d3","_", function(d3,_) {
  var xAttribute = null;
  var yAttribute = null;
  var sizeAttribute = null;
  var size = [200,200];
  var xScale = null;
  var yScale = null;
  var sizeScale = d3.scale.linear().domain([1,1]).range([2,2]);
  var useLog = false;

  /**
  * Calculates coordinates (x, dy, basey) for a group of area charts that can be stacked
  * each area chart is associated to a category in the data objects
  */
  /**
  * @ngdoc function
  * @name tide-angular.tideLayoutXY:nodes
  * @methodOf tide-angular.tideLayoutXY
  * @param {array} data Array with data objects 
  * @returns {arra} Array with layout nodes
  *
  * @description
  * Given an array of data objects, generates x & y coordinates and circle radious r for each of the nodes to be displayed in an XY chart. 
  */
  this.nodes = function(data) {

    var width = size[0];
    var height = size[1];

    if (true) {
      if (useLog) {
        xScale = d3.scale.pow().exponent(0.5).domain(d3.extent(data, function(d) {return +d[xAttribute];})).range([0,width]);
      } else {
        xScale = d3.scale.linear().domain(d3.extent(data, function(d) {return +d[xAttribute];})).range([0,width]);
      }
    }

    if (true) {
      yScale = d3.scale.linear().domain(d3.extent(data, function(d) {return +d[yAttribute];})).range([height,0]);
    }

    _.each(data, function(d) {
      d.x = xScale(d[xAttribute]);
      d.y = yScale(d[yAttribute]);
      d.r = sizeScale(d[sizeAttribute] ? d[sizeAttribute] : 1);
    }); 

    return data;
  };

  this.size = function(_) {
    if (!arguments.length) return size;
    size = _;
    return this;
  };
  // Consulta o modifica el atributa utilizado para la medida en el histograma
  this.xAttribute = function(_) {
    if(!arguments.length) return xAttribute;
    xAttribute = _;
    return this;
  };

  // Consulta o modifica el atributa utilizado para la categoría que agrupa distintos mantos
  this.yAttribute = function(_) {
    if(!arguments.length) return yAttribute;
    yAttribute = _;
    return this;
  };

  this.sizeAttribute = function(_) {
    if(!arguments.length) return sizeAttribute;
    sizeAttribute = _;
    return this;
  };


  // Gets or modifies xScale
  this.xScale = function(_) {
    if(!arguments.length) return xScale;
    xScale = _;
    return this;
  };

  // Gets or modifies yScale
  this.yScale = function(_) {
    if(!arguments.length) return yScale;
    yScale = _;
    return this;
  };

  // Gets or modifies yScale
  this.sizeScale = function(_) {
    if(!arguments.length) return sizeScale;
    sizeScale = _;
    return this;
  };

  // Gets or modifies flag for use of logaritmith scale in x axis
  this.useLog = function(_) {
    if(!arguments.length) return useLog;
    useLog = _;
    return this;
  };

  // Gets or sets size (r) for each node
  this.rSize = function(_) {
    if(!arguments.length) return rSize;
    rSize = _;
    return this;
  };


}]);




/**
* @ngdoc service
* @name tide-angular.linearRegression
* @requires underscore._
*
* @description
* Calculates linear regression parameters for a set of datapoints [[x1,y1], [x2,y2], ... [xn,yn]]
*
* Returns object {slope: slope, intercept:intercept, r2: r2, points:points}
*/
angular.module("tide-angular")
.factory("linearRegression", ["_",function(_) {
  // Calculates linear regresion on a set of data points: [[x1,y1], [x2,y2], ... [xn,yn]]
  // Returns object {slope: slope, intercept:intercept, r2: r2}

  var lr = function(data) {
    var sumX = 0;
    var sumY = 0;
    var sumX2 = 0;
    var sumY2 = 0;
    var sumXY = 0;
    var n = data.length;

    _.each(data, function(d) {
      sumX += d[0];
      sumY += d[1];
      sumX2 += d[0]*d[0];
      sumY2 += d[1]*d[1];
      sumXY += d[0]*d[1];
    });

    var slope = (n*sumXY-sumX*sumY)/(n*sumX2-sumX*sumX);
    var intercept = (sumY-slope*sumX)/n;
    var r2 = Math.pow((n*sumXY-sumX*sumY)/Math.sqrt((n*sumX2-sumX*sumX)*(n*sumY2-sumY*sumY)),2);
    var points = [];

    _.each(data, function(d) {
      var x = d[0];
      var y = d[0]*slope + intercept;
      points.push([x,y]);
    });


    return {"slope":slope, "intercept":intercept, "r2": r2, "points":points};
  };

  return lr;

}]);