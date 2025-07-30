document.addEventListener('DOMContentLoaded', function() {

    /* initialize the external events
    -----------------------------------------------------------------*/

    let containerEl = document.getElementById('external-events-list');
    new FullCalendar.Draggable(containerEl, {
      itemSelector: '.fc-event',
      eventData: function(eventEl) {
        return {
          title: eventEl.innerText.trim()
        }
      }
    });
  

    //// the individual way to do it
    // var containerEl = document.getElementById('external-events-list');
    // var eventEls = Array.prototype.slice.call(
    //   containerEl.querySelectorAll('.fc-event')
    // );
    // eventEls.forEach(function(eventEl) {
    //   new FullCalendar.Draggable(eventEl, {
    //     eventData: {
    //       title: eventEl.innerText.trim(),
    //     }
    //   });
    // });

    /* initialize the calendar
    -----------------------------------------------------------------*/

    // let calendarEl = document.getElementById('calendar');
    

    // const base_url = window.location.origin;
    // let alltime = []
    // $.ajax({
    //     url: base_url + '/sitter/calendar',
    //     type: 'POST',
    //     dataType: 'JSON',
    //     success: function (res){
    //       alltime.push(res.date_time)
    //     }
    // });

    // const base_url = window.location.origin;
    // let alldata = [];
    
    // async function fetchData() {
    //     try {
    //         const res = await $.ajax({
    //             url: base_url + '/sitter/calendar',
    //             type: 'POST',
    //             dataType: 'JSON'
    //         });
    //         return res.date_time;
    //     } catch (error) {
    //         console.error('Error fetching data:', error);
    //         throw error;
    //     }
    // }
    
    // async function fetchDataAndAlert() {
    //     try {
    //         alldata = await fetchData();
    //     } catch (error) {
    //         // Handle errors here
    //         console.error('Error fetching data:', error);
    //     }
    // }
    
    // fetchDataAndAlert();
    
    // alert(alldata)

    // let calendar = new FullCalendar.Calendar(calendarEl, {
    //   headerToolbar: {
    //     left: 'prev,next today',
    //     center: 'title',
    //     right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
    //   },
    //   initialView: 'dayGridMonth',
    //   initialDate: new Date,
    //   navLinks: true, // can click day/week names to navigate views
    //   // editable: true,
    //   selectable: true,
    //   nowIndicator: true,
    //   // dayMaxEvents: true, // allow "more" link when too many events

    //   events: [
    //     {
    //       title: 'All Day Event',
    //       start: '2024-04-01',
    //     },
    //     {
    //       title: 'Tour with our Team.',
    //       start: '2022-11-07',
    //       end: '2022-11-10'
    //     },
    //     {
    //       groupId: 999,
    //       title: 'Meeting with Team',
    //       start: '2022-11-11T16:00:00'
    //     },
    //     {
    //       groupId: 999,
    //       title: 'Upload New Project',
    //       start: '2022-11-16T16:00:00'
    //     },
    //     {
    //       title: 'Birthday Party',
    //       start: '2022-11-24',
    //       end: '2022-11-26'
    //     },
    //     {
    //       title: 'Reporting about Theme',
    //       start: '2024-04-13T10:00:00',
    //       end: '2024-04-13T12:00:00'
    //     },
    //     {
    //       title: 'Lunch',
    //       start: '2022-11-30T12:00:00'
    //     },
    //     {
    //       title: 'Meeting',
    //       start: '2022-11-12T14:30:00'
    //     },
    //     {
    //       title: 'Happy Hour',
    //       start: '2022-11-30T17:30:00'
    //     },
    //   ],
    //   // editable: true,
    //   droppable: true, // this allows things to be dropped onto the calendar
    //   drop: function(arg) {
    //     // is the "remove after drop" checkbox checked?
    //     if (document.getElementById('drop-remove').checked) {
    //       // if so, remove the element from the "Draggable Events" list
    //       arg.draggedEl.parentNode.removeChild(arg.draggedEl);
    //     }
    //   }
    // });
    // calendar.render();





    // ============= Custom Date ================ //
    let sidValue = 0;
    $(document).on("click", '#service_calendar', function(){
        sidValue = $(this).data("sid");
        initializeCalendar();
    });

    async function fetchData() {
        try {
            const base_url = window.location.origin;
            const res = await $.ajax({
              url: base_url + '/sitter/calendar',
              type: 'POST',
              dataType: 'JSON',
              data: {sidValue}
            });
            return res.date_time;
        } catch (error) {
            console.error('Error fetching data:', error);
            throw error;
        }
    }

    async function initializeCalendar() {
        try {
            let calendarEl = document.getElementById('calendar');
            
            // Initialize FullCalendar with dynamically populated events
            let calendar = new FullCalendar.Calendar(calendarEl, {
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
                },
                initialView: 'dayGridMonth',
                initialDate: new Date(),
                navLinks: true,
                selectable: true,
                nowIndicator: true,
                events: async (info, successCallback, failureCallback) => {
                    try {
                        const fetchedData = await fetchData();
                        const events = fetchedData.map(item => ({
                            title: item.title,
                            start: item.start,
                            end: item.end
                        }));
                        successCallback(events);
                    } catch (error) {
                        failureCallback(error);
                    }
                },
                droppable: true,
                drop: function(arg) {
                    // is the "remove after drop" checkbox checked?
                    if (document.getElementById('drop-remove').checked) {
                        // if so, remove the element from the "Draggable Events" list
                        arg.draggedEl.parentNode.removeChild(arg.draggedEl);
                    }
                }
            });
          
            calendar.render();
        } catch (error) {
            // Handle errors here
            console.error('Error initializing calendar:', error);
        }
    }

    initializeCalendar();

  });