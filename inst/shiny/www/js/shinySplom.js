var shinySplom = new Shiny.OutputBinding();

$.extend(shinySplom, {
  
  find: function(scope) {
    return $(scope).find(".splom");
  },
  
  getId: function(el) {
    return $(el).attr("id");
  },
  
  renderValue: function(el, dataset) {
    
    console.log("dataset\n-------\n");
    console.log(dataset);
    
    // the d3 parser generates an array of objects; RJSONIO produces
    // an object with multiple arrays. we need to reshape that data.
    
    // EG:
    // Object {Sepal.Length: Array[5], Sepal.Width: Array[5], Petal.Length: Array[5], Petal.Width: Array[5], Species: Array[5]}
    //  Petal.Length: Array[5]
    //  Petal.Width: Array[5]
    //  Sepal.Length: Array[5]
    // ...
    
    // to
    
    // Array
    //   {Petal.Length: p1, Petal.Width: w1, ...},
    //   {Petal.Length: p2, Petal.Width: w2, ...}
    // ...
    
    var data = [];
    var names = d3.keys(dataset);
    
    for (var i=0; i < dataset[ names[0] ].length; i++) {
      data[i] = {};
      for (var j=0; j < names.length; j++) {
        // console.log("dataset[ names[i] ] == " + dataset[ names[i] ]);
        data[i][ names[j] ] = dataset[ names[j] ][i];
      }
    }
    console.log("data\n----\n");
    console.log(data);
    
    // remove the old SVG if it already exists
    if ($("#splom svg").length) {
      $("#splom svg").remove();
    }
    
    // disable gridster when mousing over the SVG
    var gridster = $(".gridster ul").gridster().data('gridster');
    $("#splom")
      .mouseenter( function() {
        gridster.disable();
        $("#gridster-control").html("Gridster Disabled");
      })
      .mouseleave( function() {
        gridster.enable()
        $("#gridster-control").html("Gridster Enabled");
      });
    
    var width = 960;
    var size = 100;
    var padding = 19.5;
    
    var x = d3.scale.linear()
      .range([padding / 2, size - padding / 2]);
    
    var y = d3.scale.linear()
      .range([size - padding / 2, padding / 2]);
    
    var xAxis = d3.svg.axis()
      .scale(x)
      .orient("bottom")
      .ticks(3);
    
    var yAxis = d3.svg.axis()
      .scale(y)
      .orient("left")
      .ticks(3);
    
    var id_name = names[ names.length-1 ];
    var color = d3.scale.category10();
    var domainByTrait = {};
    var traits = d3.keys(data[0]).filter(function(d) { return d !== id_name; }),
    n = traits.length;
      
    traits.forEach(function(trait) {
      domainByTrait[trait] = d3.extent(data, function(d) { return d[trait]; });
    });
      
    xAxis.tickSize(size * n);
    yAxis.tickSize(-size * n);
    
    var brush = d3.svg.brush()
      .x(x)
      .y(y)
      .on("brushstart", brushstart)
      .on("brush", brushmove)
      .on("brushend", brushend);
    
    var svg = d3.select(el).append("svg")
      .attr("width", size * n + padding)
      .attr("height", size * n + padding)
      .append("g")
      .attr("transform", "translate(" + padding + "," + padding / 2 + ")");
    
    svg.selectAll(".x.axis")
      .data(traits)
      .enter().append("g")
      .attr("class", "x axis")
      .attr("transform", function(d, i) { return "translate(" + (n - i - 1) * size + ",0)"; })
      .each(function(d) { x.domain(domainByTrait[d]); d3.select(this).call(xAxis); });
    
    svg.selectAll(".y.axis")
      .data(traits)
      .enter().append("g")
      .attr("class", "y axis")
      .attr("transform", function(d, i) { return "translate(0," + i * size + ")"; })
      .each(function(d) { y.domain(domainByTrait[d]); d3.select(this).call(yAxis); });
    
    var cell = svg.selectAll(".cell")
      .data(cross(traits, traits))
      .enter().append("g")
      .attr("class", "cell")
      .attr("transform", function(d) { return "translate(" + (n - d.i - 1) * size + "," + d.j * size + ")"; })
      .each(plot);
    
    // Titles for the diagonal.
    cell.filter(function(d) { return d.i === d.j; }).append("text")
      .attr("x", padding)
      .attr("y", padding)
      .attr("dy", ".71em")
      .text(function(d) { return d.x; });
    
    cell.call(brush);
    
    function plot(p) {
      var cell = d3.select(this);
      
      x.domain(domainByTrait[p.x]);
      y.domain(domainByTrait[p.y]);
      
      cell.append("rect")
        .attr("class", "frame")
        .attr("x", padding / 2)
        .attr("y", padding / 2)
        .attr("width", size - padding)
        .attr("height", size - padding);
      
      cell.selectAll("circle")
        .data(data)
        .enter().append("circle")
        .attr("cx", function(d) { return x(d[p.x]); })
        .attr("cy", function(d) { return y(d[p.y]); })
        .attr("r", 3)
        .style("fill", function(d) { return color(d[id_name]); });
    }
    
    var brushCell;
    
    // Clear the previously-active brush, if any.
    function brushstart(p) {
      if (brushCell !== this) {
        d3.select(brushCell).call(brush.clear());
        x.domain(domainByTrait[p.x]);
        y.domain(domainByTrait[p.y]);
        brushCell = this;
      }
    }
    
    // Highlight the selected circles.
    function brushmove(p) {
      var e = brush.extent();
      svg.selectAll("circle").classed("hidden", function(d) {
        return e[0][0] > d[p.x] || d[p.x] > e[1][0]
        || e[0][1] > d[p.y] || d[p.y] > e[1][1];
      });
    }
    
    // If the brush is empty, select all circles.
    function brushend() {
      if (brush.empty()) svg.selectAll(".hidden").classed("hidden", false);
    }
    
    function cross(a, b) {
      var c = [], n = a.length, m = b.length, i, j;
      for (i = -1; ++i < n;) for (j = -1; ++j < m;) c.push({x: a[i], i: i, y: b[j], j: j});
      return c;
    }
    
    d3.select(self.frameElement).style("height", size * n + padding + 20 + "px");
    
  }
  
})

Shiny.outputBindings.register(shinySplom, "kevin.shinySplom");
